package parser

import (
	"os"
	"regexp"
	"strings"

	"github.com/charmbracelet/log"
	"github.com/mistweaverco/kulala-fmt/internal/config"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

type Header struct {
	Name  string
	Value string
}

type Metadata struct {
	Name  string
	Value string
}

type Section struct {
	Comments []string
	Method   string
	URL      string
	Version  string
	Headers  []Header
	Metadata []Metadata
	Body     string
}

type Document struct {
	Variables []string
	Sections  []Section
	Valid     bool
}

var caser = cases.Title(language.Und)
var metaDataRegex = regexp.MustCompile("^# @")

func parseHTTPLine(line string) (method string, url string, version string) {
	method = ""
	url = ""
	version = ""

	pattern := `^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\S+)\s*(.*?)(HTTP/\d+\.?\d?)?$`

	re := regexp.MustCompile(pattern)

	matches := re.FindStringSubmatch(line)

	if len(matches) > 0 {
		method = matches[1]
		url = matches[2]
		if matches[4] != "" {
			version = matches[4]
		} else {
			version = "HTTP/1.1" // Default to HTTP/1.1 if not provided
		}
	}

	return method, url, version
}

func isRequestLine(line string) bool {
	return strings.HasPrefix(line, "GET") || strings.HasPrefix(line, "POST") || strings.HasPrefix(line, "PUT") || strings.HasPrefix(line, "DELETE")
}

func parseSection(section string, document *Document) Section {
	in_request := true
	in_header := false
	in_body := false
	parsedSection := Section{
		Comments: []string{},
		Method:   "",
		URL:      "",
		Version:  "",
		Headers:  []Header{},
		Metadata: []Metadata{},
		Body:     "",
	}
	lines := strings.Split(section, "\n")
	for lineidx, line := range lines {
		if line == "" && !in_body {
			if !in_request && !in_body {
				in_header = false
				in_body = true
			}
			continue
		} else if strings.HasPrefix(line, "@") {
			document.Variables = append(document.Variables, line)
			continue
		} else if strings.HasPrefix(line, "# @") {
			metadata := strings.Split(metaDataRegex.ReplaceAllString(line, ""), " ")
			metaDataName := metadata[0]
			metaDataValue := strings.Join(metadata[1:], " ")
			parsedSection.Metadata = append(parsedSection.Metadata, Metadata{
				Name:  metaDataName,
				Value: metaDataValue,
			})
			continue
		} else if strings.HasPrefix(line, "#") || strings.HasPrefix(line, "//") {
			if strings.HasPrefix(line, "//") {
				line = strings.TrimPrefix(line, "//")
				line = strings.Trim(line, " ")
				line = "# " + line
			}
			parsedSection.Comments = append(parsedSection.Comments, line)
			continue
		} else if isRequestLine(line) {
			reqMethod, reqURL, reqVersion := parseHTTPLine(line)
			parsedSection.Method = reqMethod
			parsedSection.URL = reqURL
			parsedSection.Version = reqVersion
			in_request = false
			in_header = true
			continue
		} else if in_header {
			if strings.Contains(line, ":") {
				httpVersion := parsedSection.Version
				line = strings.Trim(line, " ")
				splits := strings.Split(line, ":")
				headerName := strings.ToLower(splits[0])
				headerValue := strings.Join(splits[1:], ":")
				if httpVersion != "HTTP/2" && httpVersion != "HTTP/3" {
					headerName = caser.String(headerName)
				}
				parsedSection.Headers = append(parsedSection.Headers, Header{
					Name:  headerName,
					Value: headerValue,
				})
			}
		} else if in_body {
			parsedSection.Body += line
			if lineidx != len(lines)-1 {
				parsedSection.Body += "\n"
			}
		}
	}
	return parsedSection
}

func validateSection(section Section, filepath string, document *Document) {
	if section.Method == "" {
		log.Error("Section is missing method", "file", filepath)
		document.Valid = false
	}
	if section.URL == "" {
		log.Error("Section is missing URL", "file", filepath)
		document.Valid = false
	}
}

func documentToString(document Document) string {
	documentString := ""
	variableLength := len(document.Variables)
	for idx, variable := range document.Variables {
		documentString += variable + "\n"
		if idx == variableLength-1 {
			documentString += "\n"
		}
	}
	sectionLength := len(document.Sections)
	for idx, section := range document.Sections {
		for _, comment := range section.Comments {
			documentString += comment + "\n"
		}
		for _, metadata := range section.Metadata {
			if metadata.Name == "name" {
				continue
			}
			documentString += "# @" + metadata.Name + " " + metadata.Value + "\n"
		}
		for _, metadata := range section.Metadata {
			if metadata.Name == "name" {
				documentString += "# @" + metadata.Name + " " + metadata.Value + "\n"
			}
		}
		documentString += section.Method + " " + section.URL
		if section.Version != "" {
			documentString += " " + section.Version
		}
		documentString += "\n"
		for _, header := range section.Headers {
			documentString += header.Name + ": " + header.Value + "\n"
		}
		if section.Body != "" {
			documentString += "\n" + section.Body + "\n"
		}
		if idx != sectionLength-1 {
			documentString += "\n###\n\n"
		}
	}
	return documentString
}

func parser(filepath string, flags config.ConfigFlags) {
	if !strings.HasSuffix(filepath, ".http") && !strings.HasSuffix(filepath, ".rest") {
		log.Warn("File is not a .http or .rest file, skipping.", "file", filepath)
		return
	}
	document := Document{
		Valid:     true,
		Variables: []string{},
		Sections:  []Section{},
	}
	fileContents, err := os.ReadFile(filepath)
	if err != nil {
		log.Fatal("Error reading file", "error", err)
	}
	sections := strings.Split(string(fileContents), "###")
	for _, section := range sections {
		section = strings.TrimSpace(section)
		if section == "" {
			continue
		}
		parsedSection := parseSection(section, &document)
		document.Sections = append(document.Sections, parsedSection)
		validateSection(parsedSection, filepath, &document)
	}
	if !document.Valid {
		log.Error("File is not valid, can't fix, skipping.", "file", filepath)
		return
	}
	fileContentsAsString := string(fileContents)
	documentString := documentToString(document)
	if !flags.Check {
		if fileContentsAsString != documentString {
			log.Warn("File is not formatted correctly, fixing now.", "file", filepath)
			if flags.Verbose {
				log.Info("Writing", filepath, documentString)
			}
			err := os.WriteFile(filepath, []byte(documentString), 0644)
			if err != nil {
				log.Fatal("Error writing file", "error", err)
			}
		}
	} else {
		if fileContentsAsString != documentString {
			log.Warn("File is not formatted correctly", "file", filepath)
			if flags.Verbose {
				log.Info("Expected output", filepath, documentString)
			}
		}
	}

}
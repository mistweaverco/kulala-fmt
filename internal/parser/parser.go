package parser

import (
	"os"
	"strings"

	"github.com/charmbracelet/log"
	"github.com/mistweaverco/kulala-fmt/internal/config"
)

type Section struct {
	Comments []string
	Method   string
	URL      string
	Version  string
	Headers  []string
	Metadata []string
	Body     string
}

type Document struct {
	Variables []string
	Sections  []Section
	Valid     bool
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
		Headers:  []string{},
		Metadata: []string{},
		Body:     "",
	}
	lines := strings.Split(section, "\n")
	for lineidx, line := range lines {
		if line == "" {
			if !in_request && !in_body {
				in_header = false
				in_body = true
			}
			continue
		} else if strings.HasPrefix(line, "@") {
			document.Variables = append(document.Variables, line)
			continue
		} else if strings.HasPrefix(line, "# @") {
			parsedSection.Metadata = append(parsedSection.Metadata, line)
			continue
		} else if strings.HasPrefix(line, "#") {
			parsedSection.Comments = append(parsedSection.Comments, line)
			continue
		} else if isRequestLine(line) {
			splits := strings.Split(line, " ")
			parsedSection.Method = splits[0]
			parsedSection.URL = splits[1]
			if len(splits) > 2 {
				parsedSection.Version = splits[2]
			}
			in_request = false
			in_header = true
			continue
		} else if in_header {
			if strings.Contains(line, ":") {
				parsedSection.Headers = append(parsedSection.Headers, line)
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

func validateSection(section Section, filepath string, document Document) {
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
		documentString += section.Method + " " + section.URL
		if section.Version != "" {
			documentString += " " + section.Version
		}
		documentString += "\n"
		for _, header := range section.Headers {
			documentString += header + "\n"
		}
		for _, metadata := range section.Metadata {
			documentString += metadata + "\n"
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
		validateSection(parsedSection, filepath, document)
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
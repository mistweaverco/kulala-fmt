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

type ParsedRequestBlock struct {
	Comments []string
	Method   string
	URL      string
	Version  string
	Headers  []Header
	Metadata []Metadata
	Body     string
	Delimiter string
}

type Document struct {
	Variables []string
	Blocks  []ParsedRequestBlock
	Valid     bool
}

var (
	caser         = cases.Title(language.Und)
	metaDataRegex = regexp.MustCompile("^# @")
)

func parseHTTPLine(line string) (method string, url string, version string) {
	method = ""
	url = ""
	version = ""

	pattern := `^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(.*?)\s?(HTTP/\d+\.?\d?)?$`

	re := regexp.MustCompile(pattern)

	matches := re.FindStringSubmatch(line)

	if len(matches) > 0 {
		method = matches[1]
		url = matches[2]
		if matches[3] != "" {
			version = matches[3]
		} else {
			version = "HTTP/1.1" // Default to HTTP/1.1 if not provided
		}
	}

	return method, url, version
}

func isRequestLine(line string) bool {
	return strings.HasPrefix(line, "GET") || strings.HasPrefix(line, "POST") || strings.HasPrefix(line, "PUT") || strings.HasPrefix(line, "DELETE") || strings.HasPrefix(line, "PATCH") || strings.HasPrefix(line, "HEAD") || strings.HasPrefix(line, "OPTIONS")
}

type RequestBlock struct {
	Content string
	Delimiter string
}

func parseRequestBlock(requestBlock RequestBlock, document *Document) ParsedRequestBlock {
	in_request := true
	in_header := false
	in_body := false
	parsedRequestBlock := ParsedRequestBlock{
		Comments: []string{},
		Method:   "",
		URL:      "",
		Version:  "",
		Headers:  []Header{},
		Metadata: []Metadata{},
		Body:     "",
		Delimiter: requestBlock.Delimiter,
	}
	lines := strings.Split(requestBlock.Content, "\n")
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
			parsedRequestBlock.Metadata = append(parsedRequestBlock.Metadata, Metadata{
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
			parsedRequestBlock.Comments = append(parsedRequestBlock.Comments, line)
			continue
		} else if isRequestLine(line) {
			reqMethod, reqURL, reqVersion := parseHTTPLine(line)
			parsedRequestBlock.Method = reqMethod
			parsedRequestBlock.URL = reqURL
			parsedRequestBlock.Version = reqVersion
			in_request = false
			in_header = true
			continue
		} else if in_header {
			if strings.Contains(line, ":") {
				httpVersion := parsedRequestBlock.Version
				line = strings.TrimSpace(line)
				splits := strings.Split(line, ":")
				headerName := strings.ToLower(splits[0])
				headerValue := strings.TrimSpace(strings.Join(splits[1:], ":"))
				if httpVersion != "HTTP/2" && httpVersion != "HTTP/3" {
					headerName = caser.String(headerName)
				}
				parsedRequestBlock.Headers = append(parsedRequestBlock.Headers, Header{
					Name:  headerName,
					Value: headerValue,
				})
			}
		} else if in_body {
			parsedRequestBlock.Body += line
			if lineidx != len(lines)-1 {
				parsedRequestBlock.Body += "\n"
			}
		}
	}
	return parsedRequestBlock
}

func validateSection(block ParsedRequestBlock, filepath string, document *Document) {
	if block.Method == "" {
		log.Error("Section is missing method", "file", filepath)
		document.Valid = false
	}
	if block.URL == "" {
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
	blocksLength := len(document.Blocks)
	for idx, block := range document.Blocks {
		for _, comment := range block.Comments {
			documentString += comment + "\n"
		}
		for _, metadata := range block.Metadata {
			if metadata.Name == "name" {
				continue
			}
			documentString += "# @" + metadata.Name + " " + metadata.Value + "\n"
		}
		for _, metadata := range block.Metadata {
			if metadata.Name == "name" {
				documentString += "# @" + metadata.Name + " " + metadata.Value + "\n"
			}
		}
		documentString += block.Method + " " + block.URL
		if block.Version != "" {
			documentString += " " + block.Version
		}
		documentString += "\n"
		for _, header := range block.Headers {
			documentString += header.Name + ": " + header.Value + "\n"
		}
		if block.Body != "" {
			documentString += "\n" + block.Body + "\n"
		}
		if idx != blocksLength-1 {
			documentString += "\n"+block.Delimiter+"\n\n"
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
		Blocks:  []ParsedRequestBlock{},
	}
	// read file contents as string
	fileContentsBytes, err := os.ReadFile(filepath)
	if err != nil {
		log.Fatal("Error reading file", "error", err)
	}
	fileContents := string(fileContentsBytes)
	re := regexp.MustCompile(`(?m)^###(?: .*)?$`)
	delimiterMatches := re.FindAllStringIndex(fileContents, -1)
	delimiters := re.FindAllString(fileContents, -1)
	requestBlocks := []RequestBlock{}
	start := 0
	for i, match := range delimiterMatches {
		requestBlocks = append(requestBlocks, RequestBlock{
			Content: strings.TrimSpace(fileContents[start:match[0]]),
			Delimiter: delimiters[i],
		})
		start = match[1]
	}
	requestBlocks = append(requestBlocks, RequestBlock{
		Content: strings.TrimSpace(fileContents[start:]),
		Delimiter: "",
	})

	for _, requestBlock := range requestBlocks {
		if requestBlock.Content == "" {
			continue
		}
		parsedBlock := parseRequestBlock(requestBlock, &document)
		document.Blocks = append(document.Blocks, parsedBlock)
		validateSection(parsedBlock, filepath, &document)
	}
	if !document.Valid {
		log.Error("File is not valid, can't fix, skipping.", "file", filepath)
		return
	}
	documentString := documentToString(document)
	if !flags.Check {
		if fileContents != documentString {
			log.Warn("File is not formatted correctly, fixing now.", "file", filepath)
			if flags.Verbose {
				log.Info("Writing", filepath, documentString)
			}
			err := os.WriteFile(filepath, []byte(documentString), 0o644)
			if err != nil {
				log.Fatal("Error writing file", "error", err)
			}
		}
	} else {
		if fileContents != documentString {
			log.Warn("File is not formatted correctly", "file", filepath)
			if flags.Verbose {
				log.Info("Expected output", filepath, documentString)
			}
		}
	}
}
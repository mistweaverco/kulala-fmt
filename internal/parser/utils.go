package parser

import (
	"path/filepath"
	"strings"
)

func getDirectoryPath(path string) string {
	return filepath.Dir(path)
}

func containsBothDotEnvAndHttpClientEnvJson(filepaths []string) bool {
	var hasDotEnv, hasHttpClientEnvJson bool

	for _, file := range filepaths {
		if strings.HasSuffix(file, ".env") {
			hasDotEnv = true
		}
		if strings.HasSuffix(file, "http-client.env.json") {
			hasHttpClientEnvJson = true
		}
		if hasDotEnv && hasHttpClientEnvJson {
			return true
		}
	}
	return false
}

func containsBothHttpAndRest(filepaths []string) bool {
	var hasDotEnv, hasHttpClientEnvJson bool

	for _, file := range filepaths {
		if strings.HasSuffix(file, ".rest") {
			hasDotEnv = true
		}
		if strings.HasSuffix(file, ".http") {
			hasHttpClientEnvJson = true
		}
		if hasDotEnv && hasHttpClientEnvJson {
			return true
		}
	}
	return false
}
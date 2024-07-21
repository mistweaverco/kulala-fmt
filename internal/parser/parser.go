package parser

import (
	"strings"

	"github.com/charmbracelet/log"
	"github.com/mistweaverco/kulala-fmt/internal/config"
	"github.com/mistweaverco/kulala-fmt/internal/filewalker"
)

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

func Start(flags config.ConfigFlags) {
	filepath_pkgs, _ := filewalker.GetFiles()
	for _, filepath_pkg := range filepath_pkgs {
		if containsBothDotEnvAndHttpClientEnvJson(filepath_pkg) {
			log.Warn("You have both .env and http-client.env.json files in the same directory. This is not recommended.")
		}
		if containsBothHttpAndRest(filepath_pkg) {
			log.Warn("You have both .rest and .http files in the same directory. This is not recommended.")
		}
	}
}
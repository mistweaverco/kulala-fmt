package parser

import (
	"strings"

	"github.com/charmbracelet/log"
	"github.com/mistweaverco/kulala-fmt/internal/config"
	"github.com/mistweaverco/kulala-fmt/internal/filewalker"
)

func isDotEnv(filepath string) bool {
	return strings.HasSuffix(filepath, ".env")
}

func isHttpClientEnvJson(filepath string) bool {
	return strings.HasSuffix(filepath, "http-client.env.json")
}

func Start(flags config.ConfigFlags) {
	filepath_pkgs, _ := filewalker.GetFiles()
	for _, filepath_pkg := range filepath_pkgs {
		dirpath := getDirectoryPath(filepath_pkg[0])
		if containsBothDotEnvAndHttpClientEnvJson(filepath_pkg) {
			log.Warn("You have both .env and http-client.env.json files in the same directory. This is not recommended.", "directory", dirpath)
		}
		if containsBothHttpAndRest(filepath_pkg) {
			log.Warn("You have both .rest and .http files in the same directory. This is not recommended.", "directory", dirpath)
		}
		for _, filepath := range filepath_pkg {
			if isDotEnv(filepath) {
				continue
			}
			if isHttpClientEnvJson(filepath) {
				continue
			}
			parser(filepath, flags)
		}
	}
}
package filewalker

import (
	"os"
	"path/filepath"
	"strings"
)

func GetFiles() ([][]string, error) {
	var results [][]string
	err := filepath.Walk(".", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && (strings.HasSuffix(info.Name(), ".http") || strings.HasSuffix(info.Name(), ".rest") || info.Name() == "http-client.env.json" || info.Name() == ".env") {
			dirPath := filepath.Dir(path)
			var found bool
			for i, result := range results {
				if len(result) > 0 && filepath.Dir(result[0]) == dirPath {
					results[i] = append(results[i], path)
					found = true
					break
				}
			}
			if !found {
				results = append(results, []string{path})
			}
		}
		return nil
	})

	return results, err
}
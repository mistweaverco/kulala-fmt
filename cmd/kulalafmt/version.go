package kulalafmt

import (
	"runtime"

	"github.com/charmbracelet/log"
	"github.com/spf13/cobra"
)

var VERSION string

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the version number of kulala-fmt",
	Run: func(cmd *cobra.Command, args []string) {
		log.Info("Version", runtime.GOOS, VERSION)
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
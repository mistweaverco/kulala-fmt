package kulalafmt

import (
	"os"

	"github.com/charmbracelet/log"
	"github.com/mistweaverco/kulala-fmt/internal/config"
	"github.com/mistweaverco/kulala-fmt/internal/parser"
	"github.com/spf13/cobra"
)

var cfg = config.NewConfig(config.Config{})

var rootCmd = &cobra.Command{
	Use:   "kulala-fmt",
	Short: "An opinionated 🦄 .http and .rest 🐼 files linter 💄 and formatter ⚡.",
	Long:  "Formats and lints .http and .rest files in the current directory and subdirectories.",
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) == 0 {
			log.Info("Starting kulala-fmt 🦄", "version", VERSION)
			parser.Start(cfg.GetConfigFlags())
		}
	},
}

func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().BoolVar(&cfg.Flags.DryRun, "dry-run", false, "dry run")
	rootCmd.PersistentFlags().BoolVar(&cfg.Flags.Check, "check", false, "check")
}
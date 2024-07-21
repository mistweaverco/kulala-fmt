package kulalafmt

import (
	"fmt"

	"github.com/spf13/cobra"
)

var aboutCmd = &cobra.Command{
	Use:   "about",
	Short: "Shows information about kulala-fmt",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Made with ❤️ by Marco Kellershoff - https://gorilla.moe")
	},
}

func init() {
	rootCmd.AddCommand(aboutCmd)
}
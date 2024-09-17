package config

type ConfigFlags struct {
	Check   bool
	Verbose bool
	Version bool
	InRequestVars bool
	SeparateLogicalBlocks bool
}

type Config struct {
	Flags ConfigFlags
}

func (c Config) GetConfigFlags() ConfigFlags {
	return c.Flags
}

func NewConfig(cfg Config) Config {
	return cfg
}
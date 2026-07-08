package zipupload

const (
	MaxZipSizeBytes       int64  = 20 << 20
	MaxExtractedSizeBytes uint64 = 50 << 20
	MaxFiles                     = 500
	MaxDepth                     = 12
	MaxSingleFileBytes    uint64 = 10 << 20
)

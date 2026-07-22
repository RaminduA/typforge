package compiler

func DockerVolumeArg(hostPath string) string {
	return hostPath + ":/work"
}

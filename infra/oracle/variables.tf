variable "tenancy_ocid" {
  description = "OCI tenancy OCID."
  type        = string
}

variable "user_ocid" {
  description = "OCI user OCID for Terraform API access."
  type        = string
}

variable "fingerprint" {
  description = "Fingerprint of the OCI API key."
  type        = string
}

variable "private_key_path" {
  description = "Path to OCI API private key file."
  type        = string
}

variable "region" {
  description = "OCI region."
  type        = string
}

variable "compartment_ocid" {
  description = "OCI compartment OCID where Typforge resources will be created."
  type        = string
}

variable "ssh_public_key" {
  description = "SSH public key to place on the VM."
  type        = string
}

variable "deploy_user" {
  description = "Default SSH user for the Ubuntu image."
  type        = string
  default     = "ubuntu"
}

variable "allowed_ssh_cidr" {
  description = "CIDR allowed to SSH into the VM. Use 0.0.0.0/0 for MVP only."
  type        = string
  default     = "0.0.0.0/0"
}

variable "vcn_cidr" {
  description = "VCN CIDR block."
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "Public subnet CIDR block."
  type        = string
  default     = "10.0.1.0/24"
}

variable "instance_shape" {
  description = "OCI instance shape."
  type        = string
  default     = "VM.Standard.A1.Flex"
}

variable "instance_ocpus" {
  description = "OCPUs for the flexible instance."
  type        = number
  default     = 1
}

variable "instance_memory_in_gbs" {
  description = "Memory in GB for the flexible instance."
  type        = number
  default     = 2
}

variable "boot_volume_size_gbs" {
  description = "Boot volume size in GB."
  type        = number
  default     = 50
}

variable "image_operating_system" {
  description = "OCI image operating system."
  type        = string
  default     = "Canonical Ubuntu"
}

variable "image_operating_system_version" {
  description = "OCI image operating system version."
  type        = string
  default     = "24.04"
}

variable "availability_domain_index" {
  description = "Zero-based availability domain index to try when launching the VM."
  type        = number
  default     = 0
}
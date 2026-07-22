output "vm_public_ip" {
  description = "Public IP address of the Typforge VM."
  value       = oci_core_instance.typforge.public_ip
}

output "api_domain" {
  description = "Free sslip.io domain for the Typforge API."
  value       = "${replace(oci_core_instance.typforge.public_ip, ".", "-")}.sslip.io"
}

output "api_base_url" {
  description = "Public Typforge API base URL."
  value       = "https://${replace(oci_core_instance.typforge.public_ip, ".", "-")}.sslip.io/api/v1"
}

output "ssh_command" {
  description = "SSH command for emergency manual access."
  value       = "ssh ${var.deploy_user}@${oci_core_instance.typforge.public_ip}"
}
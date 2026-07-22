terraform {
  required_version = ">= 1.6.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 7.0"
    }
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

data "oci_core_images" "ubuntu" {
  compartment_id           = var.compartment_ocid
  operating_system         = var.image_operating_system
  operating_system_version = var.image_operating_system_version
  shape                    = var.instance_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_core_vcn" "typforge" {
  compartment_id = var.compartment_ocid
  cidr_block     = var.vcn_cidr
  display_name   = "typforge-vcn"
  dns_label      = "typforge"
}

resource "oci_core_internet_gateway" "typforge" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.typforge.id
  display_name   = "typforge-internet-gateway"
  enabled        = true
}

resource "oci_core_route_table" "typforge_public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.typforge.id
  display_name   = "typforge-public-route-table"

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.typforge.id
  }
}

resource "oci_core_security_list" "typforge_public" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.typforge.id
  display_name   = "typforge-public-security-list"

  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }

  ingress_security_rules {
    protocol = "6"
    source   = var.allowed_ssh_cidr

    tcp_options {
      min = 22
      max = 22
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      min = 80
      max = 80
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      min = 443
      max = 443
    }
  }
}

resource "oci_core_subnet" "typforge_public" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.typforge.id
  cidr_block                 = var.subnet_cidr
  display_name               = "typforge-public-subnet"
  dns_label                  = "public"
  route_table_id             = oci_core_route_table.typforge_public.id
  security_list_ids          = [oci_core_security_list.typforge_public.id]
  prohibit_public_ip_on_vnic = false
}

resource "oci_core_instance" "typforge" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "typforge-oracle-free-vm"
  shape               = var.instance_shape

  shape_config {
    ocpus         = var.instance_ocpus
    memory_in_gbs = var.instance_memory_in_gbs
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.typforge_public.id
    assign_public_ip = true
    display_name     = "typforge-public-vnic"
    hostname_label   = "typforge"
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_size_gbs
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(templatefile("${path.module}/cloud-init.yaml", {
      deploy_user = var.deploy_user
    }))
  }

  freeform_tags = {
    app = "typforge"
  }
}
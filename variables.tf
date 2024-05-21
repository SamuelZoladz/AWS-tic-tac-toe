variable "region" {
  description = "Region AWS"
}

variable "iam_role" {
  description = "Nazwa roli iam"
}

variable "app_file_destination" {
  description = "Destynacja pliku aplikacji"
}

variable "app_name" {
  description = "Nazwa aplikacji Elastic Beanstalk"
}

variable "app_version" {
  description = "Wersja aplikacji Elastic Beanstalk"
}

variable "eb_solution_stack_name" {
  description = "Nazwa stosu rozwiązań dla Elastic Beanstalk"
  default     = "64bit Amazon Linux 2023 v4.3.0 running Docker"
}

variable "public_key_path" {
  description = "Klucz publiczny ssh"
}
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "5.49.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.6.1"
    }
  }
  required_version = "~> 1.7.0"
}

provider "aws" {
  region = var.region
}

resource "random_string" "random_suffix" {
  length  = 6
  special = false
  upper   = false
}

resource "aws_iam_instance_profile" "eb_instance_profile" {
  name = "${var.app_name}-iam-instance-profile-${random_string.random_suffix.result}"
  role = var.iam_role
}

resource "aws_s3_bucket" "app_bucket" {
  bucket = "${var.app_name}-bucket-${random_string.random_suffix.result}"
}

resource "aws_s3_object" "app_bucket_object" {
  bucket = aws_s3_bucket.app_bucket.bucket
  key    = "docker-compose.zip"
  source = var.app_file_destination
  etag   = filemd5(var.app_file_destination)
}

resource "aws_elastic_beanstalk_application" "eb_app" {
  name        = "${var.app_name}-eb"
  description = "${var.app_name} elastic beanstalk application"
}

resource "aws_elastic_beanstalk_application_version" "eb_app_version" {
  name        = var.app_version
  application = aws_elastic_beanstalk_application.eb_app.name
  bucket      = aws_s3_bucket.app_bucket.bucket
  key         = aws_s3_object.app_bucket_object.key
}

resource "aws_elastic_beanstalk_environment" "eb_app_env" {
  name                = "${var.app_name}-env"
  application         = aws_elastic_beanstalk_application.eb_app.name
  solution_stack_name = var.eb_solution_stack_name
  version_label       = aws_elastic_beanstalk_application_version.eb_app_version.name

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "EnvironmentType"
    value     = "SingleInstance"
  }
  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "IamInstanceProfile"
    value     = aws_iam_instance_profile.eb_instance_profile.name
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "COGNITO_POOL_ID"
    value     = aws_cognito_user_pool.user_pool.id
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "COGNITO_CLIENT_ID"
    value     = aws_cognito_user_pool_client.cognito_client.id
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "AWS_REGION"
    value     = var.region
  }

  depends_on = [
    aws_cognito_user_pool.user_pool,
    aws_cognito_user_pool_client.cognito_client
  ]
}

output "app_url" {
  value = aws_elastic_beanstalk_environment.eb_app_env.endpoint_url
}

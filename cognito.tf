resource "aws_cognito_user_pool" "user_pool" {
  name                     = "${var.app_name}-cognito-${random_string.random_suffix.result}"
  auto_verified_attributes = ["email"]
  admin_create_user_config {
    allow_admin_create_user_only = false
  }
  verification_message_template {
    email_message_by_link = "Kliknij na poniższy link, aby zweryfikować swoje konto: {##Verify Email##}"
    email_subject_by_link = "Weryfikacja konta przez link"
    default_email_option  = "CONFIRM_WITH_LINK"
  }
  password_policy {
    minimum_length    = 6
    require_lowercase = false
    require_numbers   = false
    require_symbols   = false
    require_uppercase = false
  }
}
resource "aws_cognito_user_pool_client" "cognito_client" {
  name                = "${var.app_name}-cognito-client-${random_string.random_suffix.result}"
  user_pool_id        = aws_cognito_user_pool.user_pool.id
  generate_secret     = false
  explicit_auth_flows = ["ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_PASSWORD_AUTH", "ALLOW_USER_SRP_AUTH"]
}
resource "aws_cognito_user_pool_domain" "cognito_domain" {
  domain       = "${var.app_name}-domain-${random_string.random_suffix.result}"
  user_pool_id = aws_cognito_user_pool.user_pool.id
}

output "user_pool_id" {
  value = aws_cognito_user_pool.user_pool.id
}

output "app_client_id" {
  value = aws_cognito_user_pool_client.cognito_client.id
}

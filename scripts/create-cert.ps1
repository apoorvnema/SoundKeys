# SoundKeys — Certificate Generation Script
# Generates a self-signed Code Signing Certificate for Apoorv Nema

$cert = New-SelfSignedCertificate `
  -Subject "CN=Apoorv Nema, O=SoundKeys, C=IN" `
  -Type CodeSigning `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyUsage DigitalSignature `
  -NotAfter (Get-Date).AddYears(5)

$pwd = ConvertTo-SecureString -String "SoundKeys2026!" -Force -AsPlainText
$pfxPath = ".\SoundKeys-Apoorv.pfx"

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pwd
Write-Host "=========================================================="
Write-Host "Code Signing Certificate created successfully!"
Write-Host "File: $pfxPath"
Write-Host "Thumbprint: $($cert.Thumbprint)"
Write-Host "Password: SoundKeys2026!"
Write-Host "=========================================================="
Write-Host "To use in GitHub Actions CI/CD:"
Write-Host "1. Base64 string copied to clipboard (run step 2 below):"
Write-Host "   [Convert]::ToBase64String([IO.File]::ReadAllBytes('$pfxPath')) | Set-Clipboard"
Write-Host "2. Go to GitHub Repo -> Settings -> Secrets and variables -> Actions"
Write-Host "3. Add secret 'CSC_LINK' with the copied base64 string"
Write-Host "4. Add secret 'CSC_KEY_PASSWORD' with value 'SoundKeys2026!'"
Write-Host "=========================================================="

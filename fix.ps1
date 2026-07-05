$content = Get-Content -Raw -Path 'js/app.js'

# Fix Number(fd.get('classId'))
$content = $content -replace "Number\(fd\.get\('classId'\)\)", "fd.get('classId')"

# Fix onclick generateJPG
$content = $content -replace "generateJPG\(`\$\{item\.payment\.id\}", "generateJPG('`${item.payment.id}'"
$content = $content -replace "generateJPG\(`\$\{paymentId\}", "generateJPG('`${paymentId}'"

# Fix filterByClass
$content = $content -replace "filterByClass\(`\$\{cls\.id\}", "filterByClass('`${cls.id}'"

# Fix editParent, deleteParent
$content = $content -replace "editParent\(`\$\{p\.id\}", "editParent('`${p.id}'"
$content = $content -replace "deleteParent\(`\$\{p\.id\}", "deleteParent('`${p.id}'"

# Fix viewReceipt, recordPayment
$content = $content -replace "viewReceipt\(`\$\{p\.id\}", "viewReceipt('`${p.id}'"
$content = $content -replace "recordPayment\(`\$\{p\.id\}", "recordPayment('`${p.id}'"

# Fix editPayment, undoPayment
$content = $content -replace "editPayment\(`\$\{p\.id\}", "editPayment('`${p.id}'"
$content = $content -replace "undoPayment\(`\$\{p\.id\}", "undoPayment('`${p.id}'"
$content = $content -replace "undoPayment\(`\$\{paymentId\}", "undoPayment('`${paymentId}'"

Set-Content -Path 'js/app.js' -Value $content -NoNewline
Write-Host "Replacements completed"

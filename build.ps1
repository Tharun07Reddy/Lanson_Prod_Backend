# Generate Prisma client
Write-Host "Generating Prisma client..."
npx prisma generate

# Build the project
Write-Host "Building the project..."
npx @nestjs/cli build

Write-Host "Build completed successfully!" 
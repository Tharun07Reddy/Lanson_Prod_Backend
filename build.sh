#!/bin/bash

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Build the project
echo "Building the project..."
npx @nestjs/cli build

echo "Build completed successfully!" 
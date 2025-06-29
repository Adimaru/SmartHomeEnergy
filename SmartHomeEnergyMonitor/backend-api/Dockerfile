# --- STAGE 1: Build the application ---
# Use the official .NET SDK image to build the application
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy the .csproj file first and restore dependencies
# This leverages Docker's build cache: if only .csproj changes, restore runs again.
COPY SmartHomeApi.csproj ./
RUN dotnet restore

# Copy all other application files
COPY . .

# Publish the application for release
# Output to /app/publish which will be used in the runtime stage
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# --- STAGE 2: Create the final runtime image ---
# Use the official .NET ASP.NET runtime image (smaller, optimized)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Copy the published application from the build stage
COPY --from=build /app/publish .

# Expose the port your ASP.NET Core app listens on (default for Kestrel in containers)
EXPOSE 8080 # Kestrel default HTTP port

# Define the entry point for the application
ENTRYPOINT ["dotnet", "SmartHomeApi.dll"]
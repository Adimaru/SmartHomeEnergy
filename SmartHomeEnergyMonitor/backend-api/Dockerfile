# --- STAGE 1: Build the application ---
# Use the official .NET SDK image to build the application
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy the backend-api project file and restore dependencies
# This step is optimized to use Docker's build cache effectively
COPY ["SmartHomeApi.csproj", "SmartHomeApi/"]
RUN dotnet restore "SmartHomeApi/SmartHomeApi.csproj"

# Copy the entire backend-api source code
COPY . .
WORKDIR "/src/SmartHomeApi"

# Publish the application for release
# Output to /app/publish which will be used in the runtime stage
RUN dotnet publish "SmartHomeApi.csproj" -c Release -o /app/publish /p:UseAppHost=false

# --- STAGE 2: Create the final runtime image ---
# Use the official .NET ASP.NET runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Copy the published application from the build stage
COPY --from=build /app/publish .

# Expose the port your ASP.NET Core app listens on (default for Kestrel)
EXPOSE 8080

# Define the entry point for the application
ENTRYPOINT ["dotnet", "SmartHomeApi.dll"]
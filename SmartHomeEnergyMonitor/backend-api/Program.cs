using Microsoft.AspNetCore.SignalR;
using SmartHomeApi.Hubs;
using System;
using System.Linq;
using System.Collections.Generic;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy",
        builder => builder
        .WithOrigins("http://localhost:3000", "http://127.0.0.1:3000")
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials());
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy",
        builder => builder
        .WithOrigins(
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://*.netlify.app" // Crucial for Netlify deployment
        )
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("CorsPolicy");

app.MapHub<EnergyHub>("/energyHub");

app.MapPost("/api/energy", async (EnergyData data, IHubContext<EnergyHub> hubContext) =>
{
    Console.WriteLine($"Received energy data: DeviceId={data.DeviceId}, Consumption={data.ConsumptionWatts}W, Timestamp={data.Timestamp}");

    lock (DataStore.HistoricalDataLock)
    {
        DataStore.HistoricalData.Add(data);
        if (DataStore.HistoricalData.Count > DataStore.MaxHistoricalRecords)
        {
            DataStore.HistoricalData.RemoveRange(0, DataStore.HistoricalData.Count - DataStore.MaxHistoricalRecords);
        }
    }

    await hubContext.Clients.All.SendAsync("ReceiveEnergyUpdate", data);

    if (data.ConsumptionWatts > DataStore.AlertThresholdWatts)
    {
        var alertMessage = $"{data.DeviceId} is consuming high energy: {data.ConsumptionWatts}W!";
        Console.WriteLine($"ALERT: {alertMessage}");
        await hubContext.Clients.All.SendAsync("ReceiveAlert", new { message = alertMessage, deviceId = data.DeviceId, consumption = data.ConsumptionWatts, timestamp = data.Timestamp });
    }

    return Results.Ok();
})
.WithName("PostEnergyData")
.WithOpenApi();

app.MapGet("/api/history", () =>
{
    lock (DataStore.HistoricalDataLock)
    {
        return Results.Ok(DataStore.HistoricalData.ToList());
    }
})
.WithName("GetHistoricalEnergyData")
.WithOpenApi();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

app.Run();

public static class DataStore
{
    public static List<EnergyData> HistoricalData = new List<EnergyData>();
    public static readonly object HistoricalDataLock = new object();
    public const int MaxHistoricalRecords = 1000;
    public const double AlertThresholdWatts = 170.0;
}
 
public class EnergyData
{
    public string DeviceId { get; set; } = string.Empty;
    public double ConsumptionWatts { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}

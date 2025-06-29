using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using System.Collections.Generic;

public class EnergyData
{
    public string DeviceId { get; set; } = string.Empty;
    public double ConsumptionWatts { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

class Program
{
    private static readonly HttpClient _httpClient = new HttpClient();
    private static readonly Random _random = new Random();
    private static readonly string _backendApiUrl = "https://smarthomeenergy.onrender.com";

    static async Task Main(string[] args)
    {
        Console.WriteLine("IoT Simulator Started. Press Ctrl+C to stop.");

        List<string> deviceIds = new List<string> { "Fridge001", "WashingMachine002", "Lights003" };

        while (true)
        {
            foreach (var deviceId in deviceIds)
            {
                await SimulateAndSendEnergyData(deviceId);
                await Task.Delay(500);
            }
            await Task.Delay(2000);
        }
    }

    static async Task SimulateAndSendEnergyData(string deviceId)
    {
        var consumption = _random.Next(10, 200);
        var energyData = new EnergyData
        {
            DeviceId = deviceId,
            ConsumptionWatts = consumption,
            Timestamp = DateTime.UtcNow
        };

        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Device: {energyData.DeviceId}, Consumption: {energyData.ConsumptionWatts}W");

        try
        {
            var response = await _httpClient.PostAsJsonAsync($"{_backendApiUrl}/api/energy", energyData);

            if (response.IsSuccessStatusCode)
            {
                Console.WriteLine($"Data sent successfully for {deviceId}.");
            }
            else
            {
                string errorContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"Failed to send data for {deviceId}. Status: {response.StatusCode}. Error: {errorContent}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error sending data for {deviceId}: {ex.Message}");
        }
    }
}
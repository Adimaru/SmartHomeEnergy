using MQTTnet;
using MQTTnet.Client;
using MQTTnet.Extensions.ManagedClient;
using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

public class EnergyData
{
    public string DeviceId { get; set; } = string.Empty;
    public double ConsumptionWatts { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class DeviceSimulator
{
    public string DeviceId { get; }
    private Random _random = new Random();
    private double _baseConsumption;

    public DeviceSimulator(string deviceId, double baseConsumption)
    {
        DeviceId = deviceId;
        _baseConsumption = baseConsumption;
    }

    public EnergyData GenerateData()
    {
        double consumption = _baseConsumption + (_random.NextDouble() * 100 - 50);
        if (consumption < 0) consumption = 0;

        return new EnergyData
        {
            DeviceId = DeviceId,
            ConsumptionWatts = Math.Round(consumption),
            Timestamp = DateTime.UtcNow
        };
    }
}

public class Program
{
    private const string EmqxCloudMqttHost = "ycdfbd0d.ala.eu-central-1.emqxsl.com";
    private const int EmqxCloudMqttPort = 8883;
    private const string EmqxCloudUsername = "iot_device_user";
    private const string EmqxCloudPassword = "test";

    public static async Task Main(string[] args)
    {
        Console.WriteLine("IoT Simulator Started (Sending to EMQX Cloud via MQTT). Press Ctrl+C to stop.");

        var mqttFactory = new MqttFactory();
        var managedMqttClient = mqttFactory.CreateManagedMqttClient();

        var options = new ManagedMqttClientOptionsBuilder()
            .WithAutoReconnectDelay(TimeSpan.FromSeconds(5))
            .WithClientOptions(new MqttClientOptionsBuilder()
                .WithTcpServer(EmqxCloudMqttHost, EmqxCloudMqttPort)
                .WithCredentials(EmqxCloudUsername, EmqxCloudPassword)
                .WithCleanSession()
                .WithTlsOptions(tlsOptions =>
                {
                    tlsOptions.WithAllowUntrustedCertificates(true);
                    // Removed WithSkipCertificateRevocationCheck and WithIgnoreCertificateChainErrors
                })
                .Build())
            .Build();

        await managedMqttClient.StartAsync(options);
        Console.WriteLine($"MQTT client connected to EMQX Cloud at {EmqxCloudMqttHost}:{EmqxCloudMqttPort}");

        var simulators = new List<DeviceSimulator>
        {
            new DeviceSimulator("Fridge001", 80),
            new DeviceSimulator("WashingMachine002", 120),
            new DeviceSimulator("Lights003", 50)
        };

        while (true)
        {
            foreach (var simulator in simulators)
            {
                var data = simulator.GenerateData();
                var payload = JsonSerializer.Serialize(data);
                
                var message = new MqttApplicationMessageBuilder()
                    .WithTopic("v1/devices/me/telemetry")
                    .WithPayload(payload)
                    .WithQualityOfServiceLevel(MQTTnet.Protocol.MqttQualityOfServiceLevel.AtLeastOnce)
                    .Build();

                await managedMqttClient.EnqueueAsync(message);
                Console.WriteLine($"Data sent for {data.DeviceId}: {data.ConsumptionWatts}W (to EMQX Cloud)");

                await Task.Delay(TimeSpan.FromSeconds(2));
            }
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}

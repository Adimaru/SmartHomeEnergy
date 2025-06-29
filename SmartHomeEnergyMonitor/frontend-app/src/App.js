import React, { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const App = () => {
  const [connection, setConnection] = useState(null);
  const [energyData, setEnergyData] = useState({});
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [historicalDataLoaded, setHistoricalDataLoaded] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [deviceLastSeen, setDeviceLastSeen] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const chartRef = useRef(null);

  const MAX_DATA_POINTS = 30;
  const OFFLINE_THRESHOLD_MS = 8000;

  const fetchHistoricalData = async () => {
    try {
      const response = await fetch('http://localhost:5252/api/history');
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched historical data:', data);

        const initialLabels = [];
        const initialDatasets = {};

        data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        data.forEach(item => {
          const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          setEnergyData(prevData => ({
            ...prevData,
            [item.deviceId]: item.consumptionWatts
          }));

          setDeviceLastSeen(prev => ({
            ...prev,
            [item.deviceId]: Date.now() // Update with current time for historical data fetch
          }));

          if (!initialDatasets[item.deviceId]) {
            const color = `hsl(${Math.random() * 360}, 70%, 50%)`;
            initialDatasets[item.deviceId] = {
              label: item.deviceId,
              data: [],
              borderColor: color,
              backgroundColor: color,
              tension: 0.2,
              fill: false,
              pointRadius: 3,
              pointHoverRadius: 5,
            };
          }
          initialDatasets[item.deviceId].data.push(item.consumptionWatts);

          if (!initialLabels.includes(time)) {
             initialLabels.push(time);
          }
        });

        const datasetsArray = Object.values(initialDatasets);

        const trimmedLabels = initialLabels.slice(-MAX_DATA_POINTS);
        const trimmedDatasets = datasetsArray.map(ds => ({
          ...ds,
          data: ds.data.slice(-MAX_DATA_POINTS)
        }));

        setChartData({ labels: trimmedLabels, datasets: trimmedDatasets });
        setHistoricalDataLoaded(true);
      } else {
        console.error('Failed to fetch historical data:', response.statusText);
        setHistoricalDataLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
      setHistoricalDataLoaded(true);
    }
  };


  useEffect(() => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl("https://smarthomeenergy.onrender.com/energyHub")
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);
  }, []);

  useEffect(() => {
    if (connection) {
      connection.start()
        .then(() => {
          console.log('SignalR Connected!');
          fetchHistoricalData();

          connection.on("ReceiveEnergyUpdate", (data) => {
            console.log('Received real-time data:', data);
            // This is the crucial part for debugging: is data.deviceId correct here?
            console.log(`Real-time update for device: ${data.deviceId}, LastSeen: ${new Date(Date.now()).toLocaleString()}`);


            setEnergyData(prevData => ({
              ...prevData,
              [data.deviceId]: data.consumptionWatts
            }));

            setDeviceLastSeen(prev => ({
                ...prev,
                [data.deviceId]: Date.now()
            }));

            setChartData(prevChartData => {
              let updatedLabels = [...prevChartData.labels];
              let updatedDatasets = prevChartData.datasets.map(ds => ({ ...ds, data: [...ds.data] }));

              let deviceDataset = updatedDatasets.find(ds => ds.label === data.deviceId);
              if (!deviceDataset) {
                const color = `hsl(${Math.random() * 360}, 70%, 50%)`;
                deviceDataset = {
                  label: data.deviceId,
                  data: [],
                  borderColor: color,
                  backgroundColor: color,
                  tension: 0.2,
                  fill: false,
                  pointRadius: 3,
                  pointHoverRadius: 5,
                };
                updatedDatasets.push(deviceDataset);
              }

              deviceDataset.data.push(data.consumptionWatts);

              const newTime = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              if (updatedLabels.length === 0 || updatedLabels[updatedLabels.length - 1] !== newTime) {
                updatedLabels.push(newTime);
              }

              if (updatedLabels.length > MAX_DATA_POINTS) {
                updatedLabels = updatedLabels.slice(updatedLabels.length - MAX_DATA_POINTS);
              }
              updatedDatasets = updatedDatasets.map(ds => ({
                ...ds,
                data: ds.data.slice(ds.data.length - MAX_DATA_POINTS)
              }));

              if (chartRef.current) {
                chartRef.current.update();
              }

              return { labels: updatedLabels, datasets: updatedDatasets };
            });
          });

          connection.on("ReceiveAlert", (alertData) => {
            console.log('Received alert:', alertData);
            const newAlert = {
                id: Date.now() + Math.random(),
                message: alertData.message,
                deviceId: alertData.deviceId,
                consumption: alertData.consumption,
                timestamp: alertData.timestamp,
            };
            setAlerts(prevAlerts => [...prevAlerts, newAlert]);

            setTimeout(() => {
                setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== newAlert.id));
            }, 5000);
          });
        })
        .catch(e => {
            console.error('SignalR Connection Error: ', e);
            setHistoricalDataLoaded(true);
        });
    }

    return () => {
      if (connection) {
        connection.stop();
      }
    };
  }, [connection]);

  useEffect(() => {
    const interval = setInterval(() => {
        // This interval primarily triggers a re-render so device status can be re-evaluated
        // without new data coming in, catching if a device goes offline.
        // No direct state updates within this interval.
    }, 5000);

    return () => clearInterval(interval);
  }, [deviceLastSeen, OFFLINE_THRESHOLD_MS]);

  const openDeviceModal = (deviceId) => {
    setSelectedDevice(deviceId);
    setIsModalOpen(true);
  };

  const closeDeviceModal = () => {
    setIsModalOpen(false);
    setSelectedDevice(null);
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
            font: {
                size: 14,
            }
        }
      },
      title: {
        display: true,
        text: 'Real-time Energy Consumption (Watts)',
        font: {
            size: 18,
            weight: '600',
        },
        color: '#333',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleFont: { size: 16 },
        bodyFont: { size: 14 },
        cornerRadius: 6,
        padding: 10,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Consumption (Watts)',
          font: {
              size: 16,
              weight: '500',
          },
          color: '#555',
        },
        ticks: {
            font: {
                size: 12,
            }
        },
        grid: {
            color: 'rgba(0,0,0,0.05)',
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time',
          font: {
              size: 16,
              weight: '500',
          },
          color: '#555',
        },
        ticks: {
            font: {
                size: 12,
            }
        },
        grid: {
            color: 'rgba(0,0,0,0.05)',
        }
      }
    }
  };

  return (
    <div className="app-container">
      <h1 className="app-title">Smart Home Energy Monitor</h1>

      <div className="alerts-container">
          {alerts.map(alert => (
              <div
                  key={alert.id}
                  className="alert-item"
              >
                  <span>� {alert.message}</span>
                  <button
                      onClick={() => setAlerts(prevAlerts => prevAlerts.filter(a => a.id !== alert.id))}
                      className="alert-close-btn"
                  >
                      &times;
                  </button>
              </div>
          ))}
      </div>

      <h2 className="section-title">Latest Device Readings:</h2>
      <div className={`device-readings-container ${historicalDataLoaded ? 'opacity-100' : 'opacity-50'}`}>
        {Object.entries(energyData).length === 0 && !historicalDataLoaded ? (
          <p className="loading-text">Loading historical data...</p>
        ) : Object.entries(energyData).length === 0 && historicalDataLoaded ? (
            <p className="loading-text">No data received yet.</p>
        ) : (
          Object.entries(energyData).map(([deviceId, consumption]) => {
            const isOnline = (Date.now() - (deviceLastSeen[deviceId] || 0)) < OFFLINE_THRESHOLD_MS;
            // Diagnostic log for each card
            console.log(`Rendering ${deviceId}: lastSeen=${deviceLastSeen[deviceId]}, isOnline=${isOnline}`);
            const statusClass = isOnline ? 'status-online' : 'status-offline';
            const consumptionClass = typeof consumption === 'number' && consumption > 150 ? 'consumption-high' : 'consumption-normal';

            return (
              <div key={deviceId} className="device-card"
              onClick={() => openDeviceModal(deviceId)}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <h3 className="device-card-title">
                    <span className={`status-indicator ${statusClass}`}></span>
                    {deviceId}
                </h3>
                <p className={`consumption-value ${consumptionClass}`}>
                  {consumption} W
                </p>
              </div>
            );
          })
        )}
      </div>

      <h2 className="section-title">Real-time Consumption Chart:</h2>
      <div className={`chart-container ${historicalDataLoaded ? 'opacity-100' : 'opacity-50'}`}>
        {!historicalDataLoaded && <p className="loading-text">Loading chart data...</p>}
        {historicalDataLoaded && <Line ref={chartRef} options={options} data={chartData} />}
      </div>

      <p className="connectivity-status">
        Connectivity Status: {connection ? (connection.state === signalR.HubConnectionState.Connected ? 'Connected' : connection.state) : 'Not Initialized'}
      </p>

      {isModalOpen && selectedDevice && (
          <div className="modal-overlay">
              <div className="modal-content">
                  <button className="modal-close-btn" onClick={closeDeviceModal}>&times;</button>
                  <h3 className="modal-title">Details for {selectedDevice}</h3>
                  <div className="modal-device-info">
                      <p>Current Consumption: <span className="modal-value">{energyData[selectedDevice] || 0} W</span></p>
                      <p>Last Seen: <span className="modal-value">{new Date(deviceLastSeen[selectedDevice] || Date.now()).toLocaleString()}</span></p>
                      <p>Status: <span className={
                          `status-indicator-modal ${((Date.now() - (deviceLastSeen[selectedDevice] || 0)) < OFFLINE_THRESHOLD_MS) ? 'status-online' : 'status-offline'}`
                          }></span>
                          {((Date.now() - (deviceLastSeen[selectedDevice] || 0)) < OFFLINE_THRESHOLD_MS) ? 'Online' : 'Offline'}
                      </p>
                  </div>

                  <div className="modal-chart-container">
                      <h4 className="modal-chart-title">Recent Consumption History</h4>
                      <Line
                          options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                  legend: { display: false },
                                  title: { display: false },
                                  tooltip: {
                                      mode: 'index',
                                      intersect: false,
                                      backgroundColor: 'rgba(0,0,0,0.8)',
                                      titleFont: { size: 14 },
                                      bodyFont: { size: 12 },
                                      cornerRadius: 6,
                                      padding: 10,
                                  }
                              },
                              scales: {
                                  y: {
                                      beginAtZero: true,
                                      title: { display: true, text: 'Watts', font: { size: 14 } },
                                      ticks: { font: { size: 10 } }
                                  },
                                  x: {
                                      title: { display: true, text: 'Time', font: { size: 14 } },
                                      ticks: { font: { size: 10 } }
                                  }
                              }
                          }}
                          data={{
                              labels: chartData.labels,
                              datasets: chartData.datasets.filter(ds => ds.label === selectedDevice).map(ds => ({
                                  ...ds,
                                  label: selectedDevice,
                                  data: ds.data,
                              }))
                          }}
                      />
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;

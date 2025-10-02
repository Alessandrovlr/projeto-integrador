#include <WiFi.h>
#include <PubSubClient.h>

const char* ssid = "NOME_DA_SUA_REDE";
const char* password = "SENHA_DA_SUA_REDE";

const char* mqttServer = "broker.hivemq.com";
const int mqttPort = 1883;
const char* mqttTopic = "food/pedidos";

WiFiClient espClient;
PubSubClient client(espClient);

// Impressora serial via UART
#define RXD2 16
#define TXD2 17

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2); // Impressora
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.println("Conectando ao WiFi...");
  }
  Serial.println("Conectado ao WiFi");

  client.setServer(mqttServer, mqttPort);
  client.setCallback(callback);

  while (!client.connected()) {
    if (client.connect("ESP32_PEDIDOS")) {
      Serial.println("Conectado ao MQTT");
      client.subscribe(mqttTopic);
    } else {
      delay(1000);
      Serial.println("Tentando conectar ao MQTT...");
    }
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.println("Mensagem recebida:");
  Serial.println(message);

  printPedido(message);
}

void printPedido(String pedido) {
  Serial2.write(27); Serial2.write(64); // RESET
  Serial2.println("=== PEDIDO RECEBIDO ===");
  Serial2.println(pedido);
  Serial2.println("\n-----------------------\n");
  Serial2.write(29); Serial2.write(86); Serial2.write(66); Serial2.write(0); // CUT
}

void loop() {
  client.loop();
}

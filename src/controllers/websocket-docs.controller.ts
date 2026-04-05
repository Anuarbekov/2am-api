import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';

@ApiTags('WebSocket Documentation')
@Controller('api')
export class WebSocketDocsController {
  @Get('ws/socket-io')
  @ApiOperation({
    summary: 'Socket.IO Gateway - Real-time Telemetry',
    description: `
## Socket.IO Gateway

Connect to the Socket.IO namespace for real-time telemetry streaming.

### Connection
\`\`\`javascript
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000/telemetry');
\`\`\`

### Events (Server → Client)

#### 1. Connection Established
**Event:** \`connected\`
\`\`\`json
{
  "message": "Connected — streaming oldest to newest telemetry",
  "range": {
    "from": "2026-04-04T17:00:00.000Z",
    "to": "2026-04-04T17:00:20.000Z"
  }
}
\`\`\`

#### 2. Real-time Telemetry
**Event:** \`telemetry\`
\`\`\`json
{
  "timestamp": "2026-04-04T17:00:01.000Z",
  "fuel": 45.2,
  "pressure": 120.5,
  "temp": 85.3,
  "speed": 65.0,
  "health": {
    "score": 92.5,
    "grade": "A",
    "factors": { ... }
  }
}
\`\`\`

#### 3. Stream Progress
**Event:** \`stream-progress\`
\`\`\`json
{
  "current": 150,
  "total": 1000,
  "percentage": "15.00"
}
\`\`\`

#### 4. Stream Complete
**Event:** \`stream-complete\`
\`\`\`json
{
  "message": "All telemetry data has been streamed",
  "totalRecords": 1000
}
\`\`\`

#### 5. Error
**Event:** \`error\`
\`\`\`json
{
  "message": "Error description"
}
\`\`\`

---

### Messages (Client → Server)

#### Request Historical Data
**Send Event:** \`requestHistory\`
\`\`\`javascript
socket.emit('requestHistory', { minutes: 15 });
\`\`\`

**Receive Event:** \`history\`
\`\`\`json
{
  "from": "2026-04-04T16:45:00.000Z",
  "to": "2026-04-04T17:00:00.000Z",
  "count": 450,
  "data": [ { telemetry objects } ]
}
\`\`\`

#### Request Custom Date Range
**Send Event:** \`requestReplay\`
\`\`\`javascript
socket.emit('requestReplay', {
  from: '2026-04-04T17:00:00Z',
  to: '2026-04-04T17:00:20Z'
});
\`\`\`

**Receive Event:** \`replay\`
\`\`\`json
{
  "from": "2026-04-04T17:00:00.000Z",
  "to": "2026-04-04T17:00:20.000Z",
  "data": [ { telemetry objects } ]
}
\`\`\`

---

### Example Usage

\`\`\`javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/telemetry', {
  transports: ['websocket', 'polling'],
});

socket.on('connected', (data) => {
  console.log('Connected:', data.message);
});

socket.on('telemetry', (data) => {
  console.log('Telemetry:', data);
});

socket.on('stream-progress', (data) => {
  console.log('Progress:', \`\${data.current}/\${data.total}\`);
});

socket.on('error', (error) => {
  console.error('Error:', error.message);
});

// Request last 30 minutes
socket.emit('requestHistory', { minutes: 30 });

socket.on('history', (historyData) => {
  console.log(\`Received \${historyData.count} records\`);
});
\`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Socket.IO gateway documentation',
    schema: {
      type: 'object',
      properties: {
        namespace: { type: 'string', example: '/telemetry' },
        connection: { type: 'string', example: 'io("http://localhost:3000/telemetry")' },
      },
    },
  })
  getSocketIODocs() {
    return {
      namespace: '/telemetry',
      connection: 'io("http://localhost:3000/telemetry")',
      events: {
        receive: ['connected', 'telemetry', 'stream-progress', 'stream-complete', 'error'],
        send: ['requestHistory', 'requestReplay'],
      },
      testPage: 'http://localhost:3000/websocket-test.html',
    };
  }

  @Get('ws/raw')
  @ApiOperation({
    summary: 'Raw WebSocket Endpoints',
    description: `
## Raw WebSocket Endpoints

Low-level WebSocket connections using standard \`ws://\` protocol.

### 1. Real-Time Telemetry Stream
**URL:** \`ws://localhost:3000/ws/telemetry\`

**Query Parameters:**
- \`from\` (optional): ISO-8601 start datetime
- \`to\` (optional): ISO-8601 end datetime
- \`interval\` (optional): Milliseconds between messages (default: 1000)
- \`mode\` (optional): 'fast' or 'ultra' for preset intervals

**Examples:**

Stream from database start to end:
\`\`\`
ws://localhost:3000/ws/telemetry
\`\`\`

Stream specific date range:
\`\`\`
ws://localhost:3000/ws/telemetry?from=2026-04-04T17:00:00Z&to=2026-04-04T17:00:20Z
\`\`\`

Custom message rate (50ms = 20 msg/sec):
\`\`\`
ws://localhost:3000/ws/telemetry?from=2026-04-04T17:00:00Z&to=2026-04-04T17:00:20Z&interval=50
\`\`\`

Ultra-fast mode (1000 msg/sec):
\`\`\`
ws://localhost:3000/ws/telemetry?mode=ultra
\`\`\`

---

### 2. Historical Data with Date Range
**URL:** \`ws://localhost:3000/ws/telemetry/history\`

**Query Parameters (Required):**
- \`from\`: ISO-8601 start datetime (REQUIRED)
- \`to\`: ISO-8601 end datetime (REQUIRED)
- \`interval\` (optional): Milliseconds between messages (default: 1000)
- \`mode\` (optional): 'fast' or 'ultra'

**Examples:**

\`\`\`
ws://localhost:3000/ws/telemetry/history?from=2026-04-04T17:00:00Z&to=2026-04-04T17:00:20Z
\`\`\`

With fast mode:
\`\`\`
ws://localhost:3000/ws/telemetry/history?from=2026-04-04T17:00:00Z&to=2026-04-04T17:00:20Z&mode=fast
\`\`\`

---

### 3. Replay Last N Minutes
**URL:** \`ws://localhost:3000/ws/telemetry/requestReplay\`

**Query Parameters (Required):**
- \`minutes\`: Positive number, max 10080 (7 days) (REQUIRED)
- \`interval\` (optional): Milliseconds between messages (default: 1000)
- \`mode\` (optional): 'fast' or 'ultra'

**Examples:**

Last 60 minutes:
\`\`\`
ws://localhost:3000/ws/telemetry/requestReplay?minutes=60
\`\`\`

Last 60 minutes with ultra-fast streaming:
\`\`\`
ws://localhost:3000/ws/telemetry/requestReplay?minutes=60&mode=ultra
\`\`\`

Custom 10ms interval:
\`\`\`
ws://localhost:3000/ws/telemetry/requestReplay?minutes=30&interval=10
\`\`\`

---

## Message Format

### Sent by Server (JSON)
\`\`\`json
{
  "event": "connected|telemetry|stream-progress|stream-complete|error",
  "data": { /* event-specific data */ }
}
\`\`\`

### Event Types

**connected:**
\`\`\`json
{
  "event": "connected",
  "data": {
    "message": "Connected — streaming 2026-04-04T17:00:00.000Z … 2026-04-04T17:00:20.000Z",
    "range": {
      "from": "2026-04-04T17:00:00.000Z",
      "to": "2026-04-04T17:00:20.000Z"
    }
  }
}
\`\`\`

**telemetry:**
\`\`\`json
{
  "event": "telemetry",
  "data": {
    "timestamp": "2026-04-04T17:00:01.000Z",
    "fuel": 45.2,
    "pressure": 120.5,
    "temp": 85.3,
    "speed": 65.0,
    "health": { "score": 92.5, "grade": "A", ... }
  }
}
\`\`\`

**stream-progress:**
\`\`\`json
{
  "event": "stream-progress",
  "data": {
    "current": 150,
    "total": 1000,
    "percentage": "15.00"
  }
}
\`\`\`

**stream-complete:**
\`\`\`json
{
  "event": "stream-complete",
  "data": {
    "message": "All telemetry data has been streamed",
    "totalRecords": 1000
  }
}
\`\`\`

**error:**
\`\`\`json
{
  "event": "error",
  "data": {
    "message": "Error description"
  }
}
\`\`\`

---

## Stream Rate Configuration

### Preset Modes
- \`mode=fast\` → 10ms interval → 100 messages/second
- \`mode=ultra\` → 1ms interval → 1000 messages/second (HIGH LOAD)

### Custom Intervals
- \`interval=1000\` → 1 message/second (default)
- \`interval=100\` → 10 messages/second
- \`interval=50\` → 20 messages/second
- \`interval=10\` → 100 messages/second
- \`interval=5\` → 200 messages/second
- \`interval=1\` → 1000 messages/second (extreme)

---

## Browser Testing

\`\`\`javascript
// Open browser console and run:

const ws = new WebSocket('ws://localhost:3000/ws/telemetry/requestReplay?minutes=5&mode=fast');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const { event: type, data } = JSON.parse(event.data);
  console.log(type, data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};
\`\`\`

---

## Load Testing

For high load testing, use:
- \`mode=ultra\` or \`interval=1\` for maximum message rate
- Connect multiple clients to simulate concurrent load
- Monitor server CPU and memory usage

Example load test with 10 concurrent connections:
\`\`\`bash
# Using wscat
for i in {1..10}; do
  wscat -c 'ws://localhost:3000/ws/telemetry/requestReplay?minutes=60&mode=ultra' &
done
\`\`\`
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Raw WebSocket endpoints documentation',
    schema: {
      type: 'object',
      properties: {
        telemetry: { type: 'string', example: 'ws://localhost:3000/ws/telemetry' },
        history: { type: 'string', example: 'ws://localhost:3000/ws/telemetry/history' },
        replay: { type: 'string', example: 'ws://localhost:3000/ws/telemetry/requestReplay' },
      },
    },
  })
  getRawWebSocketDocs() {
    return {
      telemetry: {
        url: 'ws://localhost:3000/ws/telemetry',
        description: 'Real-time or ranged telemetry stream',
        queryParams: ['from', 'to', 'interval', 'mode'],
      },
      history: {
        url: 'ws://localhost:3000/ws/telemetry/history',
        description: 'Historical telemetry between two dates',
        queryParams: ['from (required)', 'to (required)', 'interval', 'mode'],
      },
      replay: {
        url: 'ws://localhost:3000/ws/telemetry/requestReplay',
        description: 'Replay last N minutes of telemetry',
        queryParams: ['minutes (required)', 'interval', 'mode'],
      },
      messageRateModes: {
        default: '1000ms (1 msg/sec)',
        fast: '10ms (100 msg/sec)',
        ultra: '1ms (1000 msg/sec)',
      },
    };
  }

  @Get('ws/modes')
  @ApiOperation({
    summary: 'Stream Rate Modes Reference',
  })
  @ApiResponse({
    status: 200,
    description: 'Available stream rate modes and their settings',
  })
  getStreamModes() {
    return {
      modes: [
        {
          name: 'default',
          interval: 1000,
          messagesPerSecond: 1,
          useCase: 'Regular monitoring',
        },
        {
          name: 'fast',
          interval: 10,
          messagesPerSecond: 100,
          useCase: 'Faster feedback, testing',
        },
        {
          name: 'ultra',
          interval: 1,
          messagesPerSecond: 1000,
          useCase: 'High-load testing, stress testing',
          warning: 'May impact server performance',
        },
      ],
      customInterval: {
        description: 'Use ?interval=N where N is milliseconds',
        examples: [
          { interval: 500, messagesPerSecond: 2 },
          { interval: 100, messagesPerSecond: 10 },
          { interval: 50, messagesPerSecond: 20 },
        ],
      },
    };
  }
}


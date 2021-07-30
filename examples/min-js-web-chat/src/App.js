import './App.css';
import { getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';
import * as React from 'react';
import protons from 'protons';

const ContentTopic = `/min-js-web-chat/1/chat/proto`;

const proto = protons(`
message SimpleChatMessage {
  uint64 timestamp = 1;
  string text = 2;
}
`);

function App() {
  const [waku, setWaku] = React.useState(undefined);
  const [wakuStatus, setWakuStatus] = React.useState('None');
  const [messages, setMessages] = React.useState([]);
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [sendCounter, setSendCounter] = React.useState(0);

  React.useEffect(() => {
    if (!!waku) return;
    if (wakuStatus !== 'None') return;

    setWakuStatus('Starting');

    Waku.create().then((waku) => {
      setWaku(waku);
      setWakuStatus('Connecting');
      bootstrapWaku(waku).then(() => {
        setWakuStatus('Ready');
      });
    });
  }, [waku, wakuStatus]);

  // Need to keep the same reference around to add and delete from relay observer
  const processIncomingMessage = React.useCallback((wakuMessage) => {
    if (!wakuMessage.payload) return;

    const { text, timestamp } = proto.SimpleChatMessage.decode(
      wakuMessage.payload
    );

    const time = new Date();
    time.setTime(timestamp);
    const message = { text, timestamp: time };

    setMessages((currMessages) => {
      return [message].concat(currMessages);
    });
  }, []);

  React.useEffect(() => {
    if (!waku) return;

    waku.relay.addObserver(processIncomingMessage, [ContentTopic]);

    return function cleanUp() {
      waku.relay.deleteObserver(processIncomingMessage, [ContentTopic]);
    };
  }, [waku, wakuStatus, processIncomingMessage]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [currentTime]);

  const sendMessageOnClick = () => {
    if (wakuStatus !== 'Ready') return;

    sendMessage(`Here is message #${sendCounter}`, waku, currentTime).then(() =>
      console.log('Message sent')
    );

    setSendCounter(sendCounter + 1);
  };

  return (
    <div className="App">
      <header className="App-header">
        <p>{wakuStatus}</p>
        <button onClick={sendMessageOnClick} disabled={wakuStatus !== 'Ready'}>
          Send Message
        </button>
        <ul>
          {messages.map((msg) => {
            return (
              <li>
                <p>
                  {msg.timestamp.toString()}: {msg.text}
                </p>
              </li>
            );
          })}
        </ul>
      </header>
    </div>
  );
}

export default App;

async function bootstrapWaku(waku) {
  const nodes = await getStatusFleetNodes();
  await Promise.all(nodes.map((addr) => waku.dial(addr)));
}

async function sendMessage(message, waku, timestamp) {
  const time = timestamp.getTime();

  const payload = proto.SimpleChatMessage.encode({
    timestamp: time,
    text: message,
  });

  const wakuMessage = await WakuMessage.fromBytes(payload, ContentTopic);
  await waku.relay.send(wakuMessage);
}

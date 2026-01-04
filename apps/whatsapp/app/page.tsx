"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "../lib/eden-client";

export default function Home() {
  const [messages, setMessages] = useState<string[]>([]);
  const [status, setStatus] = useState("Disconnected");
  
  // Use a ref to store the active subscription/socket
  const chatRef = useRef<ReturnType<typeof api.chat.subscribe>>(null);

  useEffect(() => {
    // Initialize the subscription once
    const chat = api.chat.subscribe();
    chatRef.current = chat;

    chat.subscribe((message) => {
      console.log("got", message);
      setMessages((prev) => [...prev, message.data]);
    });

    chat.on("open", () => {
      setStatus("Connected");
      chat.send("hello from client");
    });

    chat.on("close", () => {
      setStatus("Disconnected");
    });

    return () => {
      chat.close();
      chatRef.current = null;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black text-black dark:text-white gap-4">
      <h1 className="text-2xl font-bold">WebSocket Test</h1>
      <p>Status: {status}</p>
      <div className="flex flex-col gap-2 border p-4 rounded w-96 h-96 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className="p-2 bg-gray-200 dark:bg-gray-800 rounded">
            {msg}
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          // Use the existing connection to send the message
          chatRef.current?.send("ping");
        }}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Send Ping
      </button>
    </div>
  );
}


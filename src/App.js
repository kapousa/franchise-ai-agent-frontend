import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown

// Main App component for the chatbot
const App = () => {
  // State to store chat messages. Each message has a 'sender' (user/bot) and 'text').
  const [messages, setMessages] = useState([]);
  // State to store the current input value in the message box.
  const [input, setInput] = useState('');
  // State to indicate if a response is currently being fetched from the backend.
  const [isLoading, setIsLoading] = useState(false);
  // State to store the unique session ID for the current chat.
  const [sessionId, setSessionId] = useState(null);
  // State to store the selected file object.
  const [selectedFile, setSelectedFile] = useState(null);
  // Ref to automatically scroll to the latest message.
  const messagesEndRef = useRef(null);
  // Ref for the file input element to trigger it programmatically.
  const fileInputRef = useRef(null);

  // Effect to generate a session ID when the component mounts (once per browser session).
  useEffect(() => {
    // Try to get session ID from localStorage to persist across refreshes
    let storedSessionId = localStorage.getItem('chatbotSessionId');
    if (!storedSessionId) {
      // If no session ID in localStorage, generate a new one
      storedSessionId = 'session_' + Date.now() + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('chatbotSessionId', storedSessionId);
    }
    setSessionId(storedSessionId);
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to scroll to the bottom of the chat window whenever messages update.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Basic validation for file types (images and text for this example)
      if (file.type.startsWith('image/') || file.type === 'text/plain') {
        setSelectedFile(file);
      } else {
        // Using a custom message box instead of alert()
        const messageBox = document.createElement('div');
        messageBox.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
        messageBox.innerHTML = `
          <div class="bg-white p-6 rounded-lg shadow-xl text-center">
            <p class="text-lg mb-4">Unsupported file type. Please upload an image (PNG, JPG) or a plain text file.</p>
            <button id="closeMessageBox" class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">OK</button>
          </div>
        `;
        document.body.appendChild(messageBox);
        document.getElementById('closeMessageBox').onclick = () => {
          document.body.removeChild(messageBox);
        };

        setSelectedFile(null);
        e.target.value = ''; // Clear the file input
      }
    }
  };

  // Function to send a message to the backend and get a response.
  const sendMessage = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior (page reload).
    if (input.trim() === '' && !selectedFile) return; // Don't send empty messages or no file.
    if (!sessionId) {
      console.error("Session ID not set. Cannot send message.");
      return;
    }

    const userMessage = { sender: 'user', text: input || (selectedFile ? `[File: ${selectedFile.name}]` : '') };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput('');
    setIsLoading(true);

    let fileContent = null;
    let fileMimeType = null;

    if (selectedFile) {
      fileMimeType = selectedFile.type;
      const reader = new FileReader();

      // Return a promise that resolves when the file is read
      const readFilePromise = new Promise((resolve, reject) => {
        reader.onload = () => {
          // For images, convert to base64. For text, get raw text.
          if (fileMimeType.startsWith('image/')) {
            // Remove the "data:image/jpeg;base64," part
            fileContent = reader.result.split(',')[1];
          } else if (fileMimeType === 'text/plain') {
            fileContent = reader.result;
          }
          resolve();
        };
        reader.onerror = (error) => reject(error);

        if (fileMimeType.startsWith('image/')) {
          reader.readAsDataURL(selectedFile); // Read image as base64
        } else if (fileMimeType === 'text/plain') {
          reader.readAsText(selectedFile); // Read text file as plain text
        }
      });

      try {
        await readFilePromise; // Wait for the file to be read
      } catch (error) {
        console.error("Error reading file:", error);
        setMessages((prevMessages) => [
          ...prevMessages,
          { sender: 'bot', text: 'Error reading your file. Please try again.' },
        ]);
        setIsLoading(false);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    try {
      const payload = {
        message: input,
        session_id: sessionId,
        file_content: fileContent,
        file_mime_type: fileMimeType,
      };

      const response = await fetch('https://franchise-ai-agent-backend.onrender.com/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMessages((prevMessages) => [...prevMessages, { sender: 'bot', text: data.response }]);
      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
        localStorage.setItem('chatbotSessionId', data.session_id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: 'bot', text: 'Oops! Something went wrong. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
      setSelectedFile(null); // Clear selected file after sending
      if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input element
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-inter">
      <div className="flex flex-col w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Chat Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-xl text-center text-2xl font-bold">
          Franchise Middle East  AI Bot (Demo)
        </div>

        {/* Messages Display Area */}
        <div className="flex-1 p-4 overflow-y-auto h-96 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-20">
              Type a message or upload a document to start chatting!
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`flex mb-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] p-3 rounded-lg shadow-md ${
                    msg.sender === 'user'
                      ? 'bg-blue-500 text-white rounded-br-none'
                      : 'bg-gray-200 text-gray-800 rounded-bl-none'
                  }`}
                >
                  {/* Use ReactMarkdown to render the message text */}
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            ))
          )}
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start mb-3">
              <div className="max-w-[75%] p-3 rounded-lg shadow-md bg-gray-200 text-gray-800 rounded-bl-none">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} /> {/* Scroll target */}
        </div>

        {/* Message Input Form */}
        <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 flex flex-col">
          {selectedFile && (
            <div className="mb-2 p-2 bg-blue-100 text-blue-800 rounded-md flex items-center justify-between">
              <span>Attached: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="ml-2 text-blue-800 hover:text-blue-600 font-bold"
              >
                &times;
              </button>
            </div>
          )}
          <div className="flex">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden" // Hide the default file input
              accept="image/png, image/jpeg, text/plain" // Accept only images and plain text
            />
            <button
              type="button" // Use type="button" to prevent form submission
              onClick={() => fileInputRef.current.click()} // Trigger hidden file input
              className="bg-gray-300 text-gray-700 p-3 hover:bg-gray-400 transition-colors duration-200"
              disabled={isLoading}
              title="Attach Document"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.415a6 6 0 108.486 8.486L20.5 13.5" />
              </svg>
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-white p-3 rounded-r-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || (input.trim() === '' && !selectedFile)}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default App;

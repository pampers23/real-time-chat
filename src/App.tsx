import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/client"
import type { Session } from "@supabase/supabase-js";
import { Avatar,   AvatarFallback,   AvatarImage } from "@/components/ui/avatar"

type ChatMessage = {
  message: string;
  user_name: string;
  avatar: string;
  timestamp: string;
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [userOnline, setUserOnline] = useState<string[]>([]);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scroll = useRef(null);
  const roomOneRef = useRef<ReturnType<typeof supabase.channel> | null>(null);


  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])


  // sign in function
  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google'
    })
  };

  // sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out error:", error.message);
    }
  }

useEffect(() => {
  if (!session?.user) {
    setUserOnline([]);
    return;
  }

  const roomOne = supabase.channel("room_one", {
    config: {
      presence: {
        key: session?.user?.id,
      }
    }
  });

  roomOneRef.current = roomOne;

  roomOne.on("broadcast", { event: "message" }, (payload) => {
    setMessages((prevMessages) => [...prevMessages, payload.payload]);
  });

  roomOne.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await roomOne.track({
        id: session?.user?.id
      });
    }
  });

  roomOne.on("presence", { event: "sync" }, () => {
    const state = roomOne.presenceState();
    setUserOnline(Object.keys(state));
  });

  return () => {
    roomOne.unsubscribe();
  };
}, [session]);


  // send message
const sendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (!newMessage.trim()) return;

  const payload = {
    message: newMessage,
    user_name: session?.user?.user_metadata?.email || "Anonymous",
    avatar: session?.user?.user_metadata?.avatar_url || "",
    timestamp: new Date().toISOString()
  };

  roomOneRef.current?.send({
    type: "broadcast",
    event: "message",
    payload
  });

  // Append locally since Supabase doesn't echo to self
  setMessages((prev) => [...prev, payload]);

  setNewMessage("");
};


  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-us", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  useEffect(() => {
    setTimeout(() => {
      if(chatContainerRef.current) {
        chatContainerRef.current.scrollTop = 
          chatContainerRef.current.scrollHeight;
      }
    }, 100)
  }, [messages]);

  if(!session) {
    return (
      <div className="w-full flex h-screen justify-center items-center">
        <Button
          onClick={signIn}
          className="cursor-pointer"
        >
          Sign in with Google</Button>
      </div>
    );
  } else {
    return (
    <div className="w-full flex h-screen justify-center items-center p-4">
      <div className="border-[1px] border-gray-700 max-w-6xl w-full min-h-[600px] rounded-lg">

        {/* header */}
        <div className="flex justify-between h-20 border-b-[1px] border-gray-700">
          <div className="p-4">
            <p className="text-gray-900">
              Signed as name <span className="text-black font-medium">{session?.user?.user_metadata?.full_name}</span>
            </p>
            <p className="text-gra  y-800 italic text-sm">
              {userOnline.length} users online
            </p>
          </div>
          <Button onClick={signOut} className="m-5 sm:mr-4 cursor-pointer">Sign out</Button>
        </div>

        {/* main chat */}
        <div
          ref={chatContainerRef}  
          className="p-4 flex flex-col overflow-y-auto h-[500px]"
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`my-2 flex w-full items-start ${
                msg?.user_name === session?.user?.email
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              {/* received msg w/ avatar left */}
              {msg?.user_name !== session?.user?.email && (
              <Avatar className="w-10 h-10 mr-2">
                <AvatarImage src={msg?.avatar} alt={msg?.user_name} />
                <AvatarFallback>{msg?.user_name?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              )}

              <div className="flex flex-col w-full">
                <div
                  className={`p-2 max-w-[70%] rounded-xl ${
                    msg?.user_name === session?.user?.email
                      ? "bg-gray-700 text-white ml-auto"
                      : "bg-gray-500 text-white mr-auto"
                  }`}
                >
                  <p>{msg.message}</p>
                </div>
                {/* time */}
                <div
                  className={`text-xs opacity-75 pt-1 ${
                    msg?.user_name === session?.user?.email
                      ? "text-right mr-2"
                      : "text-left ml-2"
                  }`}
                >
                  {formatTime(msg?.timestamp)}
                </div>
              </div>

              {msg?.user_name === session?.user?.email && (
                <Avatar className="w-10 h-10 ml-2">
                  <AvatarImage src={msg?.avatar} alt={msg?.user_name} />
                  <AvatarFallback>
                    {msg?.user_name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}  
            </div>
          ))}
        </div>

        
        {/* message input */}
        <form 
          className="flex flex-col sm:flex-row p-4 border-t-[1px] border-gray-700"
          onSubmit={sendMessage}
        >
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            type="text"
            placeholder="Type a message here..."
            className="p-2 w-full bg-black/40 rounded-lg"
          />
          <Button
            className="mt-4 sm:mt-0 sm:ml-8 bg-blue-500 text-white max-h-12"
          >
            Send
          </Button>
          <span ref={scroll}></span>
        </form>
      </div>
    </div>
  )
  }
  
}

export default App

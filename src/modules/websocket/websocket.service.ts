import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`✅ Client ulandi: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Client uzildi: ${client.id}`);
  }

  // Zikr tugatilgani haqida ma'lumot
  completedZikrNotification(zikr: any) {
    console.log("🔔 Zikr tugatilgani haqida ma'lumot yuborilmoqda:", zikr?.id);
    this.server.emit("newzikr", {
      message: "Zikr muvaffaqiyatli yakunlandi!",
      zikr: {
        id: zikr?.id,
        user: zikr?.user?.fullName || "User",
        zikr: zikr?.titleLatin,
        username: zikr?.user?.username,
        copleted: zikr?.completions?.length,
      },
    });
  }
}

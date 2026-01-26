import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AdminService } from "./admin.service";

@WebSocketGateway({
  cors: {
    origin: "*",
    credentials: true,
  },
  namespace: "/admin",
  transports: ["websocket", "polling"],
})
export class AdminGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private adminSockets: Map<string, Set<string>> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private adminService: AdminService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get("JWT_SECRET"),
      });

      // Check if user is admin
      if (payload.role !== "ADMIN") {
        client.disconnect();
        return;
      }

      const userId = payload.sub;
      client.data.userId = userId;
      client.data.isAdmin = true;

      // Add socket to admin's socket set
      if (!this.adminSockets.has(userId)) {
        this.adminSockets.set(userId, new Set());
      }
      this.adminSockets.get(userId)!.add(client.id);

      // Join admin room
      client.join("admin-room");

      // Send initial data
      await this.sendDashboardData(client);

      // Start update interval if not running
      this.startUpdateInterval();

      console.log(`Admin ${userId} connected to admin socket`);
    } catch (error) {
      console.error("Admin WebSocket auth error:", error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const adminSocketSet = this.adminSockets.get(userId);
      if (adminSocketSet) {
        adminSocketSet.delete(client.id);
        if (adminSocketSet.size === 0) {
          this.adminSockets.delete(userId);
        }
      }
      console.log(`Admin ${userId} disconnected from admin socket`);
    }

    // Stop interval if no admins connected
    if (this.adminSockets.size === 0 && this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private startUpdateInterval() {
    if (this.updateInterval) return;

    // Broadcast updates every 5 seconds when admins are connected
    this.updateInterval = setInterval(async () => {
      if (this.adminSockets.size > 0) {
        await this.broadcastDashboardUpdate();
      }
    }, 5000);
  }

  private async sendDashboardData(client: Socket) {
    try {
      const stats = await this.adminService.getExtendedDashboard();
      client.emit("dashboard:update", stats);
    } catch (error) {
      console.error("Error sending dashboard data:", error);
    }
  }

  private async broadcastDashboardUpdate() {
    try {
      const stats = await this.adminService.getExtendedDashboard();
      this.server.to("admin-room").emit("dashboard:update", stats);
    } catch (error) {
      console.error("Error broadcasting dashboard update:", error);
    }
  }

  // Manual refresh request
  @SubscribeMessage("dashboard:refresh")
  async handleRefresh(@ConnectedSocket() client: Socket) {
    await this.sendDashboardData(client);
    return { success: true };
  }

  // Notify all admins about specific events
  broadcastEvent(event: string, data: any) {
    this.server.to("admin-room").emit(event, data);
  }

  // Notify about new user registration
  notifyNewUser(user: any) {
    this.broadcastEvent("user:new", user);
  }

  // Notify about new test completion
  notifyTestCompleted(test: any) {
    this.broadcastEvent("test:completed", test);
  }

  // Notify about new zikr completion
  notifyZikrCompleted(zikr: any) {
    this.broadcastEvent("zikr:completed", zikr);
  }
}

import { Module } from "@nestjs/common";
import { WebsocketGateway } from "./websocket.service";

@Module({
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}

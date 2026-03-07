import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ZikrController } from "./zikr.controller";
import { ZikrService } from "./zikr.service";
import { Zikr, ZikrCompletion } from "./entities";
import { User } from "../users/entities";
import { WebsocketModule } from "../websocket/websocket.module";
import { AdminModule } from "../admin/admin.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Zikr, ZikrCompletion, User]),
    WebsocketModule,
    forwardRef(() => AdminModule),
    UsersModule,
  ],
  controllers: [ZikrController],
  providers: [ZikrService],
  exports: [ZikrService],
})
export class ZikrModule {}

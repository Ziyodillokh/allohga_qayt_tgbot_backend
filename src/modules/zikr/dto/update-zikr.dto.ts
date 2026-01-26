import { PartialType } from "@nestjs/swagger";
import { CreateZikrDto } from "./create-zikr.dto";

export class UpdateZikrDto extends PartialType(CreateZikrDto) {}

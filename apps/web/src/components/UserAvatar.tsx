import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { displayName, imageUrl, initial } from "@/lib/format";

type Props = {
  name: string | null | undefined;
  avatarKey: string | null | undefined;
  className?: string;
};

export const UserAvatar = ({ name, avatarKey, className }: Props) => (
  <Avatar className={cn("size-10", className)}>
    {avatarKey && <AvatarImage src={imageUrl(avatarKey)} alt={displayName(name)} />}
    <AvatarFallback>{initial(name)}</AvatarFallback>
  </Avatar>
);

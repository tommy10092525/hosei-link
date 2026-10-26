import { client } from "@/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const LoginForm = () => {
  const navigate=useNavigate()

  const loginMutation=useMutation({
    mutationFn:async({name,password}:{name:string,password:string})=>{
      const res=await client.api.login.$post({json:{
        name,password
      }});
      if(res.ok){
        const data=await res.json()
        return data
      }else{
        throw new Error("login fail")
      }
      
    },onSuccess:()=>{
      toast.success("ログインしました",{position:"top-center"})
      navigate("/images")
    },onError:()=>{
      toast.error("ログインに失敗しました")
    }
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const password = formData.get("password") as string;
        loginMutation.mutate({name,password})  
      }}
    >
      <Input id="name" name="name" />
      <Input type="password" id="password" name="password" />
      <Button type="submit">ログイン</Button>
    </form>
  );
};

export default LoginForm;

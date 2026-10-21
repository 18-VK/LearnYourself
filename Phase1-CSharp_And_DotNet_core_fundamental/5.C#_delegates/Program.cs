ClsGreet Obj = new ClsGreet();
PrintSayHello PrintMsg = Obj.funcSayHello;

PrintMsg("Hola amigo..");
// multicast delegate
Alerts alerts = new Alerts();
Notify notify = alerts.SendEmail;
notify += alerts.SendSMS;

notify(); // Calls both methods

public delegate void PrintSayHello(string Msg);
class ClsGreet
{
    public void funcSayHello(string name)
    {
        Console.WriteLine(name);
    }
}

public delegate void Notify();

public class Alerts
{
    public void SendEmail() => Console.WriteLine("Email sent"); // method
    public void SendSMS() => Console.WriteLine("SMS sent"); // method
}

param([int]$Inicio = 8090, [int]$Fim = 65000)

# Retorna a primeira porta TCP livre a partir de $Inicio.
# Usado pelo start.bat para escolher a porta do sistema (8090, 8091, ...) e a do banco.
$porta = $Inicio
while ($porta -le $Fim) {
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $porta)
        $listener.Start()
        $listener.Stop()
        Write-Output $porta
        exit 0
    } catch {
        $porta++
    }
}
# Se nao achou nenhuma, devolve a inicial mesmo (sera reportado no log).
Write-Output $Inicio
exit 1

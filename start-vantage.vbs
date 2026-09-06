' Launches start-vantage.cmd with no visible window (hidden).
' Used by the "VantageTerminal" scheduled task so the server starts silently at logon.
CreateObject("WScript.Shell").Run "cmd /c ""C:\Users\Lenovo\Downloads\Screener\vantage\start-vantage.cmd""", 0, False

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
command = """" & root & "\scripts\stop_client_windows.pyw"" --gui"
shell.Run command, 0, False

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
command = """" & root & "\scripts\enable_windows_startup.pyw"" --gui"
shell.Run command, 0, False

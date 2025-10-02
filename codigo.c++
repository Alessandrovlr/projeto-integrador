#include <iostream>
#include <fstream>
#include <string>
#include <windows.h>

bool enviarParaImpressora(const std::string& nomeImpressora, const std::string& dados) {
    HANDLE hImpressora;
    DOC_INFO_1A docInfo;
    DWORD bytesEscritos;

    hImpressora = CreateFileA(nomeImpressora.c_str(), GENERIC_WRITE, 0, NULL, OPEN_EXISTING, 0, NULL);

    if (hImpressora == INVALID_HANDLE_VALUE) {
        std::cerr << "Erro ao abrir a impressora!" << std::endl;
        return false;
    }

    docInfo.pDocName = (LPSTR)"Cupom";
    docInfo.pOutputFile = NULL;
    docInfo.pDatatype = (LPSTR)"RAW";

    if (StartDocPrinterA((HANDLE)hImpressora, 1, (LPBYTE)&docInfo)) {
        StartPagePrinter(hImpressora);
        WritePrinter(hImpressora, (LPVOID)dados.c_str(), dados.size(), &bytesEscritos);
        EndPagePrinter(hImpressora);
        EndDocPrinter(hImpressora);
    } else {
        std::cerr << "Erro ao iniciar documento de impressão!" << std::endl;
        CloseHandle(hImpressora);
        return false;
    }

    CloseHandle(hImpressora);
    return true;
}

int main() {

    std::string nomeImpressora = R"(\\.\USB001)"; 


    std::string comandos;

    comandos += "\x1B\x40"; 
    comandos += "Loja Exemplo\n";
    comandos += "CNPJ: 12.345.678/0001-99\n";
    comandos += "------------------------------\n";
    comandos += "Produto 1       R$ 10,00\n";
    comandos += "Produto 2       R$ 15,00\n";
    comandos += "------------------------------\n";
    comandos += "Total:          R$ 25,00\n";
    comandos += "------------------------------\n";

    comandos += "\x1D\x28\x6B\x03\x00\x31\x43\x08"; 
    comandos += "\x1D\x28\x6B\x03\x00\x31\x45\x30"; 
    std::string qrData = "https://www.exemplo.com";
    int qrDataLen = qrData.length() + 3;
    comandos += "\x1D\x28\x6B";
    comandos += (char)(qrDataLen & 0xFF);
    comandos += (char)((qrDataLen >> 8) & 0xFF);
    comandos += "\x31\x50\x30";
    comandos += qrData;
    comandos += "\x1D\x28\x6B\x03\x00\x31\x51\x30"; 

    comandos += "\n\n\n";
    comandos += "\x1D\x56\x42\x00";


    if (enviarParaImpressora(nomeImpressora, comandos)) {
        std::cout << "Cupom enviado com sucesso!" << std::endl;
    } else {
        std::cerr << "Erro ao enviar cupom!" << std::endl;
    }

    return 0;
}

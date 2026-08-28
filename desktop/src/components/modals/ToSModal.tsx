import React, { useState } from 'react';
import { Shield, CheckCircle2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../stores/authStore';

export const ToSModal: React.FC = () => {
  const requiresToS = useAuthStore((s) => s.requiresToS);
  const acceptToS = useAuthStore((s) => s.acceptToS);
  const [isLoading, setIsLoading] = useState(false);

  const handleAccept = async () => {
    setIsLoading(true);
    await acceptToS('v1.0.0');
    setIsLoading(false);
  };

  return (
    <Modal
      isOpen={requiresToS}
      onClose={() => {}} // Non-dismissible gatekeeper
      title="Termos de Uso & Privacidade Haven"
      description="Por favor, leia e aceite os Termos de Serviço da versão v1.0.0 para continuar utilizando o Haven"
      maxWidth="md"
    >
      <div className="flex flex-col gap-4">
        <div className="bg-haven-darker border border-haven-border rounded-xl p-4 max-h-56 overflow-y-auto text-xs text-zinc-300 space-y-3 leading-relaxed">
          <div className="flex items-center gap-2 text-haven-emerald font-semibold text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span>1. Compromisso Zero-PII</span>
          </div>
          <p className="text-zinc-400">
            O Haven não coleta, não processa e não armazena seu e-mail, número de telefone, CPF, documentos pessoais ou dados de rastreamento. Você é identificado exclusivamente pelo seu pseudônimo e hash seguro de senha.
          </p>

          <div className="flex items-center gap-2 text-haven-emerald font-semibold text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span>2. Mídia P2P e Criptografia SRTP</span>
          </div>
          <p className="text-zinc-400">
            Todas as sessões de voz, vídeo e compartilhamento de tela trafegam através do nosso SFU com criptografia SRTP de ponta a ponta e não são gravadas.
          </p>

          <div className="flex items-center gap-2 text-haven-emerald font-semibold text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span>3. Conduta da Comunidade</span>
          </div>
          <p className="text-zinc-400">
            É expressamente proibido o uso da plataforma para fins ilegais, disseminação de malware, ataques de negação de serviço ou assédio.
          </p>
        </div>

        <div className="flex items-center justify-end pt-1">
          <Button
            variant="primary"
            className="w-full gap-2 font-semibold"
            isLoading={isLoading}
            onClick={handleAccept}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Aceitar Termos e Entrar</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};

import { CheckCircle } from 'lucide-react';
export default function SuccessPage() {
  return (
    <div className="max-w-md mx-auto text-center py-24">
      <CheckCircle className="mx-auto text-green-500 mb-6" size={80} />
      <h1 className="text-3xl font-bold mb-4">Commande confirmée!</h1>
      <p className="text-gray-500">Nous vous contacterons bientôt pour confirmer la livraison.</p>
    </div>
  );
}
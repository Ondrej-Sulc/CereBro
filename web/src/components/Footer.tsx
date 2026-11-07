import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between items-center text-center sm:text-left text-sm">
          <p className="text-slate-400">&copy; {new Date().getFullYear()} CereBro. All rights reserved.</p>
          <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-2 whitespace-nowrap">
            <Link 
              href="https://github.com/Ondrej-Sulc/CereBro" 
              target="_blank"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              GitHub
            </Link>
            <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

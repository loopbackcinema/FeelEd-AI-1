import React from 'react';

export const Footer: React.FC = () => (
  <footer className="mt-16 pb-8 text-gray-700">
    <div className="max-w-4xl mx-auto border-t border-gray-200/80 pt-12">
      <div className="grid md:grid-cols-2 gap-12 text-left text-base leading-relaxed">
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800">🌿 About Us — FeelEd AI</h3>
          <p>FeelEd AI turns lessons into emotional stories — so learning feels natural, not forced.</p>
          <p>We combine education + emotion + AI to help teachers and students connect through meaningful storytelling.</p>
          <p>Our goal is simple: To make every topic feel alive, through stories that inspire curiosity, compassion, and understanding.</p>
          <p>We believe learning should touch both the mind and the heart.</p>
        </div>
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-800">📩 Contact Us</h3>
          <p>We’d love to hear from you!</p>
          <ul className="space-y-2">
            <li>📧 Email: <a href="mailto:feeledai@gmail.com" className="text-indigo-600 hover:underline">feeledai@gmail.com</a></li>
            <li>📞 Phone: <a href="tel:+919092450286" className="text-indigo-600 hover:underline">+91 90924 50286</a></li>
            <li>📍 Location: Chennai, India</li>
          </ul>
           <p className="pt-2">Whether you’re a teacher, student, or collaborator — FeelEd AI is here to make learning more human.</p>
        </div>
      </div>
      <div className="mt-12 pt-8 border-t border-gray-200/80 text-center">
        <p className="text-gray-500">
          © 2025 FeelEd AI. All rights reserved. | Powered by Gemini AI
        </p>
      </div>
    </div>
  </footer>
);

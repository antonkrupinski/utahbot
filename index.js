// index.js
// Discord bot entry point
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, Events } = require('discord.js');
const { deploycommands } = require('./deploy-commands');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const { postTicketEmbed, handleCategorySelect, handleClaim, handleClose, handleActionSelect, TICKET_CATEGORIES } = require('./ticket/ticketManager');
const { handleRename, handleAddUser } = require('./ticket/commands');
const { data: slashCommands } = require('./ticket/registerCommands');
const { runErlcCommand, getErlcPlayers } = require('./erlc');

// Set bot status to ERLC players, then to 'loading' after 5 seconds
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    try {
        const playerCount = await getErlcPlayers();
        await client.user.setActivity(`Erlc Players: ${playerCount}`, { type: 0 });
    } catch (e) {
        await client.user.setActivity('Erlc Players: error', { type: 0 });
    }
    setTimeout(() => {
        client.user.setActivity('Loading', { type: 0 });
    }, 5000);
    // Post ticket embed on ready
    await postTicketEmbed(client);

    // Send image embed and Information embed to channel 1455034556104052901
    const channel = await client.channels.fetch('1455034556104052901');
    if (channel && channel.isTextBased()) {
        // Send both embeds in one message
        const imageEmbed = {
            color: 0xfdfafa,
            image: {
                url: 'https://media.discordapp.net/attachments/1455034584969380076/1455322759507873963/info.jpg?ex=6954f730&is=6953a5b0&hm=a084ca12a41242cd6f8f6c1a91f23d8eb67b8ab67c861bf3bc33168862763791&=&format=webp'
            }
        };
        const infoEmbed = {
            color: 0xfdfafa,
            title: 'Information',
            description: 'Welcome to Utah State Roleplay\'s Dashboard Channel! Below is everything you need',
            fields: [
                {
                    name: '<:UtahNew:1455039396268212367> Important Links:',
                    value: '\n- **Roblox Group** - Coming Soon\n- **Moderation Application** - Coming Soon\n- **Bot Updates**\n`No updates yet`',
                    inline: false
                },
                {
                    name: 'Important Channels',
                    value: '\n<#1455034565474254901>\n<#1455034554636308521>\n<#1455034560969703468>',
                    inline: false
                }
            ],
            image: {
                url: 'https://media.discordapp.net/attachments/1455024557730562174/1455553532265631865/image.png?ex=6955255c&is=6953d3dc&hm=fcfe819b26c542582a7df7f8169c236ffe772a1071da26f9b719bd6b56f1b59d&=&format=webp&quality=lossless'
            },
            footer: {
                text: '© Copyrighted Material',
                iconURL: 'https://images-ext-1.discordapp.net/external/thvkraD4X2sMmBnN_z1dqDd3eRJYUprbnUd7IGQkCXc/%3Fsize%3D4096/https/cdn.discordapp.com/icons/1424933331426086994/2cf881225c29b4c865f389164c21caba.png?format=webp&quality=lossless'
            },
            author: {
                name: 'Utah State Roleplay',
                iconURL: 'https://images-ext-1.discordapp.net/external/thvkraD4X2sMmBnN_z1dqDd3eRJYUprbnUd7IGQkCXc/%3Fsize%3D4096/https/cdn.discordapp.com/icons/1424933331426086994/2cf881225c29b4c865f389164c21caba.png?format=webp&quality=lossless'
            }
        };
        await channel.send({ embeds: [imageEmbed, infoEmbed] });
        await channel.send({ embeds: [imageEmbed, infoEmbed] });
    }
    // Register slash commands for tickets
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: slashCommands }
        );
        console.log('Ticket slash commands registered.');
    } catch (err) {
        console.error('Failed to register ticket slash commands:', err);
    }
});

client.on('interactionCreate', async interaction => {
    // Ticket dropdown for category
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category') {
        return handleCategorySelect(interaction);
    }
    // Ticket dropdown for actions
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_action') {
        return handleActionSelect(interaction);
    }
    // Ticket claim/close buttons
    if (interaction.isButton()) {
        if (interaction.customId === 'ticket_claim') return handleClaim(interaction);
        if (interaction.customId === 'ticket_close') return handleClose(interaction);
    }
    // /add-user slash command
    if (interaction.isChatInputCommand() && interaction.commandName === 'add-user') {
        return handleAddUser(interaction);
    }
    // Existing ERLC command
    if (interaction.isChatInputCommand() && interaction.commandName === 'erlc') {
        const commandText = interaction.options.getString('text');
        await interaction.deferReply({ ephemeral: true });
        try {
            await runErlcCommand(commandText);
            await interaction.editReply({ content: '✅ Successfully executed', ephemeral: true });
        } catch (err) {
            await interaction.editReply({ content: `❌ Error: ${err.message}`, ephemeral: true });
        }
    }
});

// !rename command for tickets
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!rename ')) return;
    const args = message.content.slice('!rename '.length).trim().split(/ +/);
    await handleRename(message, args);
});

client.login(process.env.BOT_TOKEN);
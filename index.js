// (moved) Welcome new members handler placed after client initialization
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

// Welcome new members with info and membercount buttons
client.on('guildMemberAdd', async member => {
    try {
        const channel = await member.guild.channels.fetch('1429990116553658429').catch(() => null);
        if (!channel || !channel.isTextBased()) return;
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const infoButton = new ButtonBuilder()
            .setLabel('Information')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.com/channels/1429990114255310849/1455927265207779370');
    const memberCountButton = new ButtonBuilder()
        .setLabel(`${member.guild.memberCount}`)
        .setStyle(ButtonStyle.Secondary)
        .setCustomId('membercount_disabled')
        .setDisabled(true);
    const row = new ActionRowBuilder().addComponents(infoButton, memberCountButton);
    await channel.send({
        content: `Welcome <@${member.id}> to California State Roleplay! We hope you enjoy your stay!`,
        components: [row]
    });
    } catch (err) {
        console.error('Error in guildMemberAdd handler:', err);
    }
});

const { postTicketEmbed, handleCategorySelect, handleClaim, handleClose, handleActionSelect, TICKET_CATEGORIES } = require('./ticket/ticketManager');
const { handleRename, handleAddUser } = require('./ticket/commands');
const { data: slashCommands } = require('./ticket/registerCommands');
const { runErlcCommand, getErlcPlayers } = require('./erlc');
const { postLogSearchEmbed, handleLogSearchButton, handleLogSearchModal } = require('./ticket/logSearch');

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

    // Post log search embed in logging channel
    await postLogSearchEmbed(client);

    // Post rules embed with dropdown to channel 1429990115974840466
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
    const rulesChannel = await client.channels.fetch('1429990115974840466').catch(() => null);
    if (rulesChannel && rulesChannel.isTextBased()) {
        const bannerembed = new EmbedBuilder()
            .setColor(0x319736)
            .setImage('https://media.discordapp.net/attachments/1455024557730562174/1455910147124887573/image.png?ex=6956717c&is=69551ffc&hm=d47c3d0c9a30aba79ad6cca3a8ddb463d0fb6a677c558581d1bf62bc6d84e0cb&=&format=webp&quality=lossless');
        const rulesEmbed = new EmbedBuilder()
            .setTitle('Regulations')
            .setDescription('Hello, welcome to our regulations section. Please select from the dropdown menu below to view either our Discord server rules or our in-game rules.')
            .setColor(0x319736)
            .setImage('https://media.discordapp.net/attachments/1455024557730562174/1455910191928181019/image.png?ex=69567187&is=69552007&hm=66762b7a55a48c707ec6e3f9f2488841c51c6b5c1f83300fde7f2c9753cd5f83&=&format=webp&quality=lossless');
        const rulesSelect = new StringSelectMenuBuilder()
            .setCustomId('rules_select')
            .setPlaceholder('Select rules to view...')
            .addOptions([
                {
                    label: 'Discord Rules',
                    value: 'discord_rules',
                    description: 'View Discord server rules',
                    emoji: { id: '1455937378442285077' }
                },
                {
                    label: 'In-Game Rules',
                    value: 'ingame_rules',
                    description: 'View in-game rules',
                    emoji: { id: '1455937954445791232' }
                },
            ]);
        const rulesRow = new ActionRowBuilder().addComponents(rulesSelect);
        await rulesChannel.send({ embeds: [bannerembed, rulesEmbed], components: [rulesRow] });
    }

    // Send image embed and Information embed to channel 1455034556104052901
    const channel = await client.channels.fetch('1455927265207779370');
    if (channel && channel.isTextBased()) {
        // Send both embeds in one message
        const imageEmbed = {
            color: 0x319736,
            image: {
                url: 'https://media.discordapp.net/attachments/1455024557730562174/1455910146399273011/CSRP_INFO.png?ex=6956717c&is=69551ffc&hm=f63a228fa9771d622b482464a6291d47b86465d39e763c59796ab20d10df6002&=&format=webp&quality=lossless'
            }
        };
        const infoEmbed = {
            color: 0x319736,
            title: 'Information',
            description: 'Welcome to California State Roleplay\'s Dashboard Channel! Below is everything you need',
            fields: [
                {
                    name: '<:California:1455911436088774658> Important Links:',
                    value: '\n- **Roblox Group** - Coming Soon\n- **Moderation Application** - **[Click Me](https://docs.google.com/forms/d/e/1FAIpQLSezVNksME3fGnGxXsDjOmW3FdepuX0aYqZmaPfuyjbMydAyXQ/viewform?usp=dialog)**\n- **Bot Updates**\n`Changed to California State Roleplay Assets`',
                    inline: false
                },
                {
                    name: 'Important Channels',
                    value: '\n<#1429990115974840466>\n<#1429990116331491421>\n<#1429990115974840467>',
                    inline: false
                }
            ],
            image: {
                url: 'https://media.discordapp.net/attachments/1455024557730562174/1455910191928181019/image.png?ex=69567187&is=69552007&hm=66762b7a55a48c707ec6e3f9f2488841c51c6b5c1f83300fde7f2c9753cd5f83&=&format=webp&quality=lossless'
            },
            footer: {
                text: '© Copyrighted Material',
                iconURL: 'https://media.discordapp.net/attachments/1429990115974840461/1455927813436739675/5612fa371eb7caa6acae94d6b9d91cb6.png?ex=695681f0&is=69553070&hm=0af39e2bb0e936ace47d6ddffa10594a4a0746b03c17eed18f070f65f7793cb3&=&format=webp&quality=lossless'
            },
            author: {
                name: 'California State Roleplay',
                iconURL: 'https://media.discordapp.net/attachments/1429990115974840461/1455927813436739675/5612fa371eb7caa6acae94d6b9d91cb6.png?ex=695681f0&is=69553070&hm=0af39e2bb0e936ace47d6ddffa10594a4a0746b03c17eed18f070f65f7793cb3&=&format=webp&quality=lossless'
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
    try {
        // Ticket dropdown for category
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category') {
            return handleCategorySelect(interaction);
        }
    // Ticket dropdown for actions
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_action') {
        return handleActionSelect(interaction);
    }
    // Log search button
    if (interaction.isButton() && interaction.customId === 'log_search_button') {
        return handleLogSearchButton(interaction);
    }
    // Log search modal
    if (interaction.isModalSubmit && interaction.customId === 'log_search_modal') {
        return handleLogSearchModal(interaction, client);
    }
        // Rules dropdown
        if (interaction.isStringSelectMenu() && interaction.customId === 'rules_select') {
            let embed;
            if (interaction.values[0] === 'discord_rules') {
            embed = {
                color: 0x319736,
                title: 'Discord Server Rules',
                image: {
                    url: 'https://media.discordapp.net/attachments/1455024557730562174/1455910147124887573/image.png?ex=6956717c&is=69551ffc&hm=d47c3d0c9a30aba79ad6cca3a8ddb463d0fb6a677c558581d1bf62bc6d84e0cb&=&format=webp&quality=lossless'
                },
                description: [
                    '`1` Swearing\nWhilst we allow swearing, constant use of profanities especially in unneeded situations will result in moderation. The use of any vulgar profanity will also result in moderation.',
                    '`2` Mentions\nMentioning users repeatedly or unnecessarily will result in moderation. Mentioning VIP\'s or Management+ for no reason will also not be tolerated. To turn off mention upon reply click \'@mention\' button.',
                    '`3` Not Safe For Work\nNot Safe For Work (NSFW) content or language will not be tolerated and will result in a ban.',
                    '`4` Self Advertising\nAdvertising your own server in people\'s DMs or in channels will not be tolerated and can result in a ban.',
                    '`5` Language\nThis is a Australian based server, so the required language all members are expected to speak is English.',
                    '`6` Spamming\nSpamming messages, images, or reactions will not be tolerated and will result in moderation.',
                    '`7` Discrimination & Hate Speech\nAny form of discrimination or hate speech towards any individual or group will not be tolerated and will result in a ban.',
                    '`8` Personal Information\nSharing personal information of yourself or others will not be tolerated and will result in a ban.',
                    '`9` Impersonation\nImpersonating staff members or other users will not be tolerated and will result in moderation.',
                    '`10` Following Discord TOS\nAll members must adhere to Discord\'s Terms of Service at all times while on this server.',
                    '`11` Following Staff Instructions\nAll members must follow the instructions given by staff members. Failure to do so may result in moderation.',
                    '`12` Appeals\nIf you wish to appeal a moderation action, please contact a member of Management+ our support system.',
                ].join('\n'),
            };
        } else if (interaction.values[0] === 'ingame_rules') {
            embed = {
                color: 0x319736,
                title: 'In-Game Rules',
                image: {
                    url: 'https://media.discordapp.net/attachments/1455024557730562174/1455910192260459520/image.png?ex=6956718b&is=6955200f&hm=1f3f3f3e2e2f4f5d6e7f8f9fa0b1c2d3e4f5f6f7f8f9fa0b1c2d3e4f5f6f7f8f9&=&format=webp&quality=lossless'
                },
                description: [
                    '`1` No exploiting or cheating.',
                    '`2` Respect all players and staff.',
                    '`3` No griefing or trolling.',
                    '`4` Follow all roleplay guidelines.',
                    '`5` Listen to staff instructions.',
                    '`6` No offensive language or behavior.',
                    '`7` No spamming or advertising.',
                    '`8` Use appropriate character names.',
                    '`9` Realistic Avatars only.',
                    '`10` Report rule violations to staff.',
                ].join('\n'),
            };
        }
            if (embed) {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({ content: 'Unknown rules category.', ephemeral: true });
            }
            return;
        }
        // end rules_select
        
        // Ticket claim/close buttons
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
    } catch (err) {
        console.error('Error handling interactionCreate:', err);
        try {
            if (interaction && typeof interaction.reply === 'function' && !interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred while processing this interaction.', ephemeral: true });
            }
        } catch (e) {
            // ignore reply errors (interaction may be expired)
        }
    }
});

// Prevent process crash when the client emits an 'error' event
client.on('error', (err) => {
    console.error('Discord client error event:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// !rename command for tickets
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!rename ')) return;
    const args = message.content.slice('!rename '.length).trim().split(/ +/);
    await handleRename(message, args);
});

client.login(process.env.BOT_TOKEN);